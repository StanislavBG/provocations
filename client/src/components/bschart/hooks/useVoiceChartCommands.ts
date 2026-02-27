import { useCallback, useState } from "react";
import type { BSNodeType, BSNode, BSConnector, BSPortSide, BSNodeStyle } from "../types";

/**
 * Voice command engine for chart design — 2.0
 *
 * ── ADD ──
 *   "add table called Users"
 *   "add diamond called Is Valid"
 *   "add rectangle"                          (auto-names)
 *   "add badge called V2"
 *
 * ── ADD RELATIVE ──
 *   "add table called Orders right of Users"
 *   "add diamond called Check below Orders"
 *
 * ── CONNECT ──
 *   "connect Users to Orders"
 *   "connect Users to Orders with has many"
 *
 * ── MOVE (relative) ──
 *   "move Orders right of Users"
 *   "move Orders above Users"
 *
 * ── MOVE (absolute / nudge) ──
 *   "move Users up"    / "nudge Users left"
 *   "move Users up 100"
 *
 * ── DELETE / REMOVE ──
 *   "delete Users"
 *   "remove all"
 *
 * ── RENAME ──
 *   "rename Users to Accounts"
 *
 * ── LABEL connector ──
 *   "label Users to Orders with has many"
 *
 * ── SET PROPERTY ──
 *   "set Users color to blue"
 *   "set Users fill to red"
 *   "set Users text color to white"
 *   "set Users font size to 16"
 *   "set Users width to 300"
 *   "set Users height to 150"
 *   "set Users border radius to 12"
 *   "set Users bold"
 *   "set Users opacity to 0.5"
 *
 * ── RESIZE ──
 *   "resize Users to 300 by 200"
 *   "make Users wider"  / "make Users taller"
 *
 * ── TABLE OPS ──
 *   "add row to Users"
 *   "add column Type to Users"
 *   "set Users row 1 column 1 to email"
 *   "fill Users email with varchar"
 *
 * ── SELECT ──
 *   "select Users"
 *   "select all"
 *   "deselect"
 *
 * ── UNDO / REDO ──
 *   "undo"  /  "redo"
 *
 * ── DUPLICATE ──
 *   "duplicate Users"
 *   "copy Users"
 *
 * ── LIST ──
 *   "list nodes"  / "what's on the canvas"
 *
 * ── HELP ──
 *   "help"  /  "what can I say"
 */

// ── Props ──

interface VoiceChartCommandsProps {
  nodes: BSNode[];
  connectors: BSConnector[];
  onAddNode: (type: BSNodeType, x: number, y: number, label?: string) => string;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onDeleteNodes: (nodeIds: string[]) => void;
  onUpdateNode: (nodeId: string, updates: Partial<BSNode>) => void;
  onUpdateNodeStyle: (nodeId: string, style: Partial<BSNodeStyle>) => void;
  onResizeNode: (nodeId: string, width: number, height: number) => void;
  onAddConnector: (fromNodeId: string, fromPort: BSPortSide, toNodeId: string, toPort: BSPortSide, label?: string) => string;
  onUpdateConnector: (connectorId: string, updates: Partial<BSConnector>) => void;
  onAddTableRow: (nodeId: string) => void;
  onAddTableColumn: (nodeId: string, label: string) => void;
  onUpdateTableCell: (nodeId: string, rowId: string, colId: string, value: string) => void;
  onSelectNodes: (nodeIds: string[], additive?: boolean) => void;
  onClearSelection: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
}

// ── Command history entry ──

export interface VoiceCommandEntry {
  id: number;
  transcript: string;
  result: string;
  success: boolean;
  timestamp: number;
}

// ── Parsed command ──

type CommandType =
  | "add" | "add-relative" | "connect" | "move-relative" | "move-nudge"
  | "delete" | "rename" | "label-connector"
  | "set-style" | "set-property" | "resize" | "resize-relative"
  | "table-add-row" | "table-add-column" | "table-set-cell"
  | "select" | "select-all" | "deselect"
  | "undo" | "redo" | "duplicate"
  | "list" | "help" | "unknown";

interface ParsedCommand {
  type: CommandType;
  nodeType?: BSNodeType;
  label?: string;
  from?: string;
  to?: string;
  direction?: "left" | "right" | "above" | "below" | "up" | "down";
  relativeTo?: string;
  connectorLabel?: string;
  property?: string;
  value?: string;
  numValue?: number;
  numValue2?: number;
  columnLabel?: string;
  rowIndex?: number;
  colIndex?: number;
}

// ── Aliases ──

const NODE_TYPE_ALIASES: Record<string, BSNodeType> = {
  table: "table",
  rectangle: "rectangle",
  rect: "rectangle",
  box: "rectangle",
  process: "rectangle",
  widget: "rectangle",
  "rounded rect": "rounded-rect",
  "rounded rectangle": "rounded-rect",
  "round rect": "rounded-rect",
  "round box": "rounded-rect",
  service: "rounded-rect",
  oval: "rounded-rect",
  diamond: "diamond",
  decision: "diamond",
  condition: "diamond",
  "if block": "diamond",
  text: "text",
  annotation: "text",
  note: "text",
  comment: "text",
  badge: "badge",
  tag: "badge",
  chip: "badge",
};

const DIRECTION_ALIASES: Record<string, "left" | "right" | "above" | "below"> = {
  left: "left",
  "left of": "left",
  "to the left of": "left",
  "to the left": "left",
  right: "right",
  "right of": "right",
  "to the right of": "right",
  "to the right": "right",
  above: "above",
  "above of": "above",
  over: "above",
  "on top of": "above",
  below: "below",
  "below of": "below",
  under: "below",
  beneath: "below",
};

const NUDGE_ALIASES: Record<string, "up" | "down" | "left" | "right"> = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
};

const COLOR_NAMES: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  purple: "#8b5cf6",
  violet: "#7c3aed",
  pink: "#ec4899",
  cyan: "#06b6d4",
  teal: "#14b8a6",
  white: "#ffffff",
  black: "#000000",
  gray: "#6b7280",
  grey: "#6b7280",
  "light gray": "#d1d5db",
  "light grey": "#d1d5db",
  "dark gray": "#374151",
  "dark grey": "#374151",
  slate: "#64748b",
  amber: "#f59e0b",
  indigo: "#6366f1",
};

function resolveColor(name: string): string | null {
  const lower = name.toLowerCase().trim();
  if (COLOR_NAMES[lower]) return COLOR_NAMES[lower];
  // Accept hex colors directly
  if (/^#[0-9a-fA-F]{3,8}$/.test(lower)) return lower;
  return null;
}

function resolveNodeType(str: string): BSNodeType | undefined {
  return NODE_TYPE_ALIASES[str.toLowerCase().trim()];
}

// ── Default placement ──

const NUDGE_STEP = 40;

// ── Hook ──

export function useVoiceChartCommands({
  nodes,
  connectors,
  onAddNode,
  onMoveNode,
  onDeleteNodes,
  onUpdateNode,
  onUpdateNodeStyle,
  onResizeNode,
  onAddConnector,
  onUpdateConnector,
  onAddTableRow,
  onAddTableColumn,
  onUpdateTableCell,
  onSelectNodes,
  onClearSelection,
  onUndo,
  onRedo,
  onDuplicate,
}: VoiceChartCommandsProps) {
  const [lastResult, setLastResult] = useState("");
  const [commandHistory, setCommandHistory] = useState<VoiceCommandEntry[]>([]);
  let entryCounter = 0;

  // ── Node lookup ──

  const findNode = useCallback(
    (name: string): BSNode | undefined => {
      const lower = name.toLowerCase().trim();
      // Exact match first
      let match = nodes.find(
        (n) => n.voiceLabel.toLowerCase() === lower || n.label.toLowerCase() === lower,
      );
      if (match) return match;
      // Partial / fuzzy: starts with
      match = nodes.find(
        (n) =>
          n.voiceLabel.toLowerCase().startsWith(lower) ||
          n.label.toLowerCase().startsWith(lower),
      );
      if (match) return match;
      // Contains
      match = nodes.find(
        (n) =>
          n.voiceLabel.toLowerCase().includes(lower) ||
          n.label.toLowerCase().includes(lower),
      );
      return match;
    },
    [nodes],
  );

  const findConnector = useCallback(
    (fromName: string, toName: string): BSConnector | undefined => {
      const fromNode = findNode(fromName);
      const toNode = findNode(toName);
      if (!fromNode || !toNode) return undefined;
      return connectors.find(
        (c) => c.fromNodeId === fromNode.id && c.toNodeId === toNode.id,
      );
    },
    [findNode, connectors],
  );

  // ── Smart placement: find open spot near existing nodes ──

  const getPlacementPosition = useCallback(
    (relativeDirection?: "left" | "right" | "above" | "below", relativeToName?: string) => {
      const gap = 50;
      if (relativeDirection && relativeToName) {
        const ref = findNode(relativeToName);
        if (ref) {
          switch (relativeDirection) {
            case "right":  return { x: ref.x + ref.width + gap,  y: ref.y };
            case "left":   return { x: ref.x - 200 - gap,        y: ref.y };
            case "above":  return { x: ref.x,                     y: ref.y - 100 - gap };
            case "below":  return { x: ref.x,                     y: ref.y + ref.height + gap };
          }
        }
      }
      // Default: place to the right of the last node, or at (100, 100)
      if (nodes.length === 0) return { x: 100, y: 100 };
      const last = nodes[nodes.length - 1];
      return { x: last.x + last.width + gap, y: last.y };
    },
    [nodes, findNode],
  );

  // ── Parse ──

  const parse = useCallback(
    (transcript: string): ParsedCommand => {
      const text = transcript.toLowerCase().trim();

      // ── UNDO / REDO ──
      if (/^undo$/i.test(text)) return { type: "undo" };
      if (/^redo$/i.test(text)) return { type: "redo" };

      // ── HELP ──
      if (/^(?:help|what can i say|commands|voice commands)$/i.test(text)) return { type: "help" };

      // ── LIST ──
      if (/^(?:list|list nodes|list all|what'?s on the canvas|show nodes|inventory)$/i.test(text)) return { type: "list" };

      // ── SELECT ALL ──
      if (/^select all$/i.test(text)) return { type: "select-all" };

      // ── DESELECT ──
      if (/^(?:deselect|deselect all|clear selection|unselect)$/i.test(text)) return { type: "deselect" };

      // ── SELECT <name> ──
      const selectMatch = text.match(/^select\s+(.+)$/i);
      if (selectMatch) return { type: "select", label: selectMatch[1].trim() };

      // ── DUPLICATE <name> ──
      const dupMatch = text.match(/^(?:duplicate|copy|clone)\s+(.+)$/i);
      if (dupMatch) return { type: "duplicate", label: dupMatch[1].trim() };

      // ── DELETE ALL ──
      if (/^(?:delete all|remove all|clear canvas|clear all)$/i.test(text)) {
        return { type: "delete", label: "__all__" };
      }

      // ── ADD ROW TO <table> ──
      const addRowMatch = text.match(/^add\s+row\s+to\s+(.+)$/i);
      if (addRowMatch) return { type: "table-add-row", label: addRowMatch[1].trim() };

      // ── ADD COLUMN <name> TO <table> ──
      const addColMatch = text.match(/^add\s+column\s+(.+?)\s+to\s+(.+)$/i);
      if (addColMatch) return { type: "table-add-column", columnLabel: addColMatch[1].trim(), label: addColMatch[2].trim() };

      // ── SET <table> ROW <n> COLUMN <n> TO <value> ──
      const setCellMatch = text.match(/^(?:set|fill)\s+(.+?)\s+row\s+(\d+)\s+column\s+(\d+)\s+(?:to|with|as)\s+(.+)$/i);
      if (setCellMatch) {
        return {
          type: "table-set-cell",
          label: setCellMatch[1].trim(),
          rowIndex: parseInt(setCellMatch[2]) - 1,
          colIndex: parseInt(setCellMatch[3]) - 1,
          value: setCellMatch[4].trim(),
        };
      }

      // ── FILL <table> <column-name> WITH <value> (for first empty row) ──
      const fillCellMatch = text.match(/^fill\s+(.+?)\s+(\w+)\s+(?:with|to|as)\s+(.+)$/i);
      if (fillCellMatch) {
        return {
          type: "table-set-cell",
          label: fillCellMatch[1].trim(),
          columnLabel: fillCellMatch[2].trim(),
          value: fillCellMatch[3].trim(),
        };
      }

      // ── SET <node> BOLD / NORMAL ──
      const setBoldMatch = text.match(/^(?:set|make)\s+(.+?)\s+(bold|normal)$/i);
      if (setBoldMatch) {
        return {
          type: "set-style",
          label: setBoldMatch[1].trim(),
          property: "fontWeight",
          value: setBoldMatch[2].toLowerCase(),
        };
      }

      // ── RESIZE <node> TO <w> BY <h> ──
      const resizeMatch = text.match(/^resize\s+(.+?)\s+to\s+(\d+)\s+(?:by|x|×)\s+(\d+)$/i);
      if (resizeMatch) {
        return {
          type: "resize",
          label: resizeMatch[1].trim(),
          numValue: parseInt(resizeMatch[2]),
          numValue2: parseInt(resizeMatch[3]),
        };
      }

      // ── MAKE <node> WIDER/TALLER/SMALLER/BIGGER ──
      const resizeRelMatch = text.match(/^make\s+(.+?)\s+(wider|narrower|taller|shorter|bigger|smaller)$/i);
      if (resizeRelMatch) {
        return {
          type: "resize-relative",
          label: resizeRelMatch[1].trim(),
          value: resizeRelMatch[2].toLowerCase(),
        };
      }

      // ── SET <node> <property> TO <value> ──
      const setPropMatch = text.match(/^set\s+(.+?)\s+(fill|fill color|color|text color|font size|font|width|height|border radius|radius|opacity|stroke|stroke color)\s+(?:to|=)\s+(.+)$/i);
      if (setPropMatch) {
        return {
          type: "set-style",
          label: setPropMatch[1].trim(),
          property: setPropMatch[2].toLowerCase().trim(),
          value: setPropMatch[3].trim(),
        };
      }

      // ── SET <node> COLOR <value> (shorthand) ──
      const setColorShort = text.match(/^(?:set|make|color)\s+(.+?)\s+(?:to\s+)?(\w+)$/i);
      if (setColorShort && resolveColor(setColorShort[2])) {
        return {
          type: "set-style",
          label: setColorShort[1].trim(),
          property: "fill",
          value: setColorShort[2].trim(),
        };
      }

      // ── ADD <type> CALLED <name> <direction> <ref> (add-relative) ──
      const addRelMatch = text.match(
        /^add\s+([\w\s]+?)(?:\s+called\s+|\s+named\s+)(.+?)\s+(left of|right of|above|below|to the left of|to the right of|over|under)\s+(.+)$/i,
      );
      if (addRelMatch) {
        const nodeType = resolveNodeType(addRelMatch[1]);
        const dir = DIRECTION_ALIASES[addRelMatch[3].toLowerCase()];
        if (nodeType && dir) {
          return {
            type: "add-relative",
            nodeType,
            label: addRelMatch[2].trim(),
            direction: dir,
            relativeTo: addRelMatch[4].trim(),
          };
        }
      }

      // ── ADD <type> CALLED <name> ──
      const addMatch = text.match(
        /^add\s+([\w\s]+?)(?:\s+called\s+|\s+named\s+)(.+)$/i,
      );
      if (addMatch) {
        const nodeType = resolveNodeType(addMatch[1]);
        if (nodeType) return { type: "add", nodeType, label: addMatch[2].trim() };
      }

      // ── ADD <type> <name> (fallback, less specific) ──
      const addFallback = text.match(/^add\s+([\w\s]+?)\s+(\w[\w\s]*)$/i);
      if (addFallback) {
        const nodeType = resolveNodeType(addFallback[1]);
        if (nodeType) return { type: "add", nodeType, label: addFallback[2].trim() };
      }

      // ── ADD <type> (no name) ──
      const simpleAdd = text.match(/^add\s+([\w\s]+?)$/i);
      if (simpleAdd) {
        const nodeType = resolveNodeType(simpleAdd[1]);
        if (nodeType) return { type: "add", nodeType };
      }

      // ── CONNECT <from> TO <to> WITH <label> ──
      const connectMatch = text.match(
        /^connect\s+(.+?)\s+to\s+(.+?)(?:\s+(?:with|as|label)\s+(.+))?$/i,
      );
      if (connectMatch) {
        return {
          type: "connect",
          from: connectMatch[1].trim(),
          to: connectMatch[2].trim(),
          connectorLabel: connectMatch[3]?.trim(),
        };
      }

      // ── LABEL <from> TO <to> WITH <label> ──
      const labelMatch = text.match(
        /^label\s+(.+?)\s+to\s+(.+?)\s+(?:with|as)\s+(.+)$/i,
      );
      if (labelMatch) {
        return {
          type: "label-connector",
          from: labelMatch[1].trim(),
          to: labelMatch[2].trim(),
          connectorLabel: labelMatch[3].trim(),
        };
      }

      // ── MOVE <node> <direction> <ref> (relative) ──
      const moveRelMatch = text.match(
        /^move\s+(.+?)\s+(left of|right of|above|below|to the left of|to the right of|over|under|beneath)\s+(.+)$/i,
      );
      if (moveRelMatch) {
        const dir = DIRECTION_ALIASES[moveRelMatch[2].toLowerCase()];
        if (dir) {
          return {
            type: "move-relative",
            label: moveRelMatch[1].trim(),
            direction: dir,
            relativeTo: moveRelMatch[3].trim(),
          };
        }
      }

      // ── MOVE <node> UP/DOWN/LEFT/RIGHT [amount] (nudge) ──
      const nudgeMatch = text.match(
        /^(?:move|nudge|push)\s+(.+?)\s+(up|down|left|right)(?:\s+(\d+))?$/i,
      );
      if (nudgeMatch) {
        return {
          type: "move-nudge",
          label: nudgeMatch[1].trim(),
          direction: NUDGE_ALIASES[nudgeMatch[2].toLowerCase()],
          numValue: nudgeMatch[3] ? parseInt(nudgeMatch[3]) : NUDGE_STEP,
        };
      }

      // ── DELETE <name> / REMOVE <name> ──
      const deleteMatch = text.match(/^(?:delete|remove)\s+(.+)$/i);
      if (deleteMatch) return { type: "delete", label: deleteMatch[1].trim() };

      // ── RENAME <old> TO <new> ──
      const renameMatch = text.match(/^rename\s+(.+?)\s+to\s+(.+)$/i);
      if (renameMatch) return { type: "rename", from: renameMatch[1].trim(), to: renameMatch[2].trim() };

      return { type: "unknown" };
    },
    [findNode],
  );

  // ── Execute ──

  const executeCommand = useCallback(
    (transcript: string): string => {
      const cmd = parse(transcript);
      let msg = "";
      let success = true;

      switch (cmd.type) {
        // ── UNDO / REDO ──
        case "undo":
          onUndo();
          msg = "Undone.";
          break;

        case "redo":
          onRedo();
          msg = "Redone.";
          break;

        // ── HELP ──
        case "help":
          msg = [
            "Voice commands:",
            "  add <shape> called <name>",
            "  add <shape> called <name> right of <ref>",
            "  connect <A> to <B> [with <label>]",
            "  move <node> right of <ref>",
            "  move <node> up/down/left/right [px]",
            "  set <node> fill/color to <color>",
            "  set <node> font size to <n>",
            "  set <node> bold / normal",
            "  resize <node> to <w> by <h>",
            "  make <node> wider/taller/smaller/bigger",
            "  add row to <table>",
            "  add column <name> to <table>",
            "  fill <table> row N column N to <value>",
            "  rename <old> to <new>",
            "  delete <node> / delete all",
            "  select <node> / select all / deselect",
            "  duplicate <node>",
            "  list nodes",
            "  undo / redo",
          ].join("\n");
          break;

        // ── LIST ──
        case "list":
          if (nodes.length === 0) {
            msg = "Canvas is empty.";
          } else {
            msg = nodes.map((n) =>
              `${n.voiceLabel || n.label} (${n.type})`,
            ).join(", ");
          }
          break;

        // ── SELECT ──
        case "select": {
          const sn = findNode(cmd.label || "");
          if (!sn) { msg = `Cannot find "${cmd.label}"`; success = false; break; }
          onSelectNodes([sn.id]);
          msg = `Selected "${sn.voiceLabel || sn.label}"`;
          break;
        }

        case "select-all":
          onSelectNodes(nodes.map((n) => n.id));
          msg = `Selected all ${nodes.length} nodes`;
          break;

        case "deselect":
          onClearSelection();
          msg = "Deselected all.";
          break;

        // ── DUPLICATE ──
        case "duplicate": {
          if (cmd.label) {
            const dn = findNode(cmd.label);
            if (!dn) { msg = `Cannot find "${cmd.label}"`; success = false; break; }
            onSelectNodes([dn.id]);
          }
          onDuplicate();
          msg = `Duplicated${cmd.label ? ` "${cmd.label}"` : ""}`;
          break;
        }

        // ── ADD (no relative) ──
        case "add": {
          if (!cmd.nodeType) { msg = "Could not determine shape type."; success = false; break; }
          const pos = getPlacementPosition();
          onAddNode(cmd.nodeType, pos.x, pos.y, cmd.label);
          msg = `Added ${cmd.nodeType}${cmd.label ? ` "${cmd.label}"` : ""}`;
          break;
        }

        // ── ADD RELATIVE ──
        case "add-relative": {
          if (!cmd.nodeType) { msg = "Could not determine shape type."; success = false; break; }
          const pos = getPlacementPosition(cmd.direction as "left" | "right" | "above" | "below", cmd.relativeTo);
          onAddNode(cmd.nodeType, pos.x, pos.y, cmd.label);
          msg = `Added ${cmd.nodeType} "${cmd.label}" ${cmd.direction} ${cmd.relativeTo}`;
          break;
        }

        // ── CONNECT ──
        case "connect": {
          if (!cmd.from || !cmd.to) { msg = "Missing source or target."; success = false; break; }
          const fn = findNode(cmd.from);
          const tn = findNode(cmd.to);
          if (!fn) { msg = `Cannot find "${cmd.from}"`; success = false; break; }
          if (!tn) { msg = `Cannot find "${cmd.to}"`; success = false; break; }
          // Smart port: pick the nearest logical port
          const fromPort = fn.x < tn.x ? "right" as BSPortSide : fn.x > tn.x ? "left" as BSPortSide : fn.y < tn.y ? "bottom" as BSPortSide : "top" as BSPortSide;
          const toPort = tn.x > fn.x ? "left" as BSPortSide : tn.x < fn.x ? "right" as BSPortSide : tn.y > fn.y ? "top" as BSPortSide : "bottom" as BSPortSide;
          onAddConnector(fn.id, fromPort, tn.id, toPort, cmd.connectorLabel);
          msg = `Connected ${cmd.from} → ${cmd.to}${cmd.connectorLabel ? ` (${cmd.connectorLabel})` : ""}`;
          break;
        }

        // ── LABEL CONNECTOR ──
        case "label-connector": {
          if (!cmd.from || !cmd.to || !cmd.connectorLabel) { msg = "Missing parameters."; success = false; break; }
          const conn = findConnector(cmd.from, cmd.to);
          if (!conn) { msg = `No connector from "${cmd.from}" to "${cmd.to}"`; success = false; break; }
          onUpdateConnector(conn.id, { label: cmd.connectorLabel });
          msg = `Labeled connector: "${cmd.connectorLabel}"`;
          break;
        }

        // ── MOVE RELATIVE ──
        case "move-relative": {
          if (!cmd.label || !cmd.direction || !cmd.relativeTo) { msg = "Missing move parameters."; success = false; break; }
          const mn = findNode(cmd.label);
          const rn = findNode(cmd.relativeTo);
          if (!mn) { msg = `Cannot find "${cmd.label}"`; success = false; break; }
          if (!rn) { msg = `Cannot find "${cmd.relativeTo}"`; success = false; break; }
          const gap = 50;
          let newX = rn.x, newY = rn.y;
          switch (cmd.direction) {
            case "right": newX = rn.x + rn.width + gap; newY = rn.y; break;
            case "left":  newX = rn.x - mn.width - gap;  newY = rn.y; break;
            case "above": newX = rn.x; newY = rn.y - mn.height - gap; break;
            case "below": newX = rn.x; newY = rn.y + rn.height + gap; break;
          }
          onMoveNode(mn.id, newX, newY);
          msg = `Moved "${cmd.label}" ${cmd.direction} "${cmd.relativeTo}"`;
          break;
        }

        // ── MOVE NUDGE (absolute direction) ──
        case "move-nudge": {
          if (!cmd.label || !cmd.direction) { msg = "Missing move parameters."; success = false; break; }
          const nn = findNode(cmd.label);
          if (!nn) { msg = `Cannot find "${cmd.label}"`; success = false; break; }
          const step = cmd.numValue || NUDGE_STEP;
          let nx = nn.x, ny = nn.y;
          switch (cmd.direction) {
            case "up":    ny -= step; break;
            case "down":  ny += step; break;
            case "left":  nx -= step; break;
            case "right": nx += step; break;
          }
          onMoveNode(nn.id, nx, ny);
          msg = `Moved "${cmd.label}" ${cmd.direction} ${step}px`;
          break;
        }

        // ── DELETE ──
        case "delete": {
          if (cmd.label === "__all__") {
            onDeleteNodes(nodes.map((n) => n.id));
            msg = "Cleared canvas.";
            break;
          }
          if (!cmd.label) { msg = "Missing node name."; success = false; break; }
          const dn = findNode(cmd.label);
          if (!dn) { msg = `Cannot find "${cmd.label}"`; success = false; break; }
          onDeleteNodes([dn.id]);
          msg = `Deleted "${cmd.label}"`;
          break;
        }

        // ── RENAME ──
        case "rename": {
          if (!cmd.from || !cmd.to) { msg = "Missing rename parameters."; success = false; break; }
          const rn2 = findNode(cmd.from);
          if (!rn2) { msg = `Cannot find "${cmd.from}"`; success = false; break; }
          onUpdateNode(rn2.id, { label: cmd.to, voiceLabel: cmd.to });
          msg = `Renamed "${cmd.from}" → "${cmd.to}"`;
          break;
        }

        // ── SET STYLE ──
        case "set-style": {
          if (!cmd.label || !cmd.property) { msg = "Missing parameters."; success = false; break; }
          const sn = findNode(cmd.label);
          if (!sn) { msg = `Cannot find "${cmd.label}"`; success = false; break; }

          const prop = cmd.property.toLowerCase();
          const val = cmd.value || "";

          if (prop === "fill" || prop === "fill color" || prop === "color") {
            const color = resolveColor(val);
            if (!color) { msg = `Unknown color "${val}"`; success = false; break; }
            onUpdateNodeStyle(sn.id, { fillColor: color });
            msg = `Set "${cmd.label}" fill to ${val}`;
          } else if (prop === "stroke" || prop === "stroke color") {
            const color = resolveColor(val);
            if (!color) { msg = `Unknown color "${val}"`; success = false; break; }
            onUpdateNodeStyle(sn.id, { strokeColor: color });
            msg = `Set "${cmd.label}" stroke to ${val}`;
          } else if (prop === "text color") {
            const color = resolveColor(val);
            if (!color) { msg = `Unknown color "${val}"`; success = false; break; }
            onUpdateNodeStyle(sn.id, { textColor: color });
            msg = `Set "${cmd.label}" text color to ${val}`;
          } else if (prop === "font size" || prop === "font") {
            const size = parseInt(val);
            if (!size || size < 6 || size > 72) { msg = `Invalid font size "${val}"`; success = false; break; }
            onUpdateNodeStyle(sn.id, { fontSize: size });
            msg = `Set "${cmd.label}" font size to ${size}`;
          } else if (prop === "fontweight") {
            onUpdateNodeStyle(sn.id, { fontWeight: val === "bold" ? "bold" : "normal" });
            msg = `Set "${cmd.label}" font weight to ${val}`;
          } else if (prop === "border radius" || prop === "radius") {
            const r = parseInt(val);
            if (isNaN(r)) { msg = `Invalid radius "${val}"`; success = false; break; }
            onUpdateNodeStyle(sn.id, { borderRadius: r });
            msg = `Set "${cmd.label}" border radius to ${r}`;
          } else if (prop === "opacity") {
            const o = parseFloat(val);
            if (isNaN(o) || o < 0 || o > 1) { msg = `Invalid opacity "${val}" (0-1)`; success = false; break; }
            onUpdateNodeStyle(sn.id, { opacity: o });
            msg = `Set "${cmd.label}" opacity to ${o}`;
          } else if (prop === "width") {
            const w = parseInt(val);
            if (!w || w < 20) { msg = `Invalid width "${val}"`; success = false; break; }
            onResizeNode(sn.id, w, sn.height);
            msg = `Set "${cmd.label}" width to ${w}`;
          } else if (prop === "height") {
            const h = parseInt(val);
            if (!h || h < 20) { msg = `Invalid height "${val}"`; success = false; break; }
            onResizeNode(sn.id, sn.width, h);
            msg = `Set "${cmd.label}" height to ${h}`;
          } else {
            msg = `Unknown property "${prop}"`; success = false;
          }
          break;
        }

        // ── RESIZE ──
        case "resize": {
          if (!cmd.label) { msg = "Missing node name."; success = false; break; }
          const rn = findNode(cmd.label);
          if (!rn) { msg = `Cannot find "${cmd.label}"`; success = false; break; }
          onResizeNode(rn.id, cmd.numValue || rn.width, cmd.numValue2 || rn.height);
          msg = `Resized "${cmd.label}" to ${cmd.numValue}×${cmd.numValue2}`;
          break;
        }

        // ── RESIZE RELATIVE ──
        case "resize-relative": {
          if (!cmd.label) { msg = "Missing node name."; success = false; break; }
          const rn = findNode(cmd.label);
          if (!rn) { msg = `Cannot find "${cmd.label}"`; success = false; break; }
          const delta = 40;
          switch (cmd.value) {
            case "wider":   onResizeNode(rn.id, rn.width + delta, rn.height); break;
            case "narrower": onResizeNode(rn.id, Math.max(40, rn.width - delta), rn.height); break;
            case "taller":  onResizeNode(rn.id, rn.width, rn.height + delta); break;
            case "shorter": onResizeNode(rn.id, rn.width, Math.max(24, rn.height - delta)); break;
            case "bigger":  onResizeNode(rn.id, rn.width + delta, rn.height + delta); break;
            case "smaller": onResizeNode(rn.id, Math.max(40, rn.width - delta), Math.max(24, rn.height - delta)); break;
          }
          msg = `Made "${cmd.label}" ${cmd.value}`;
          break;
        }

        // ── TABLE: ADD ROW ──
        case "table-add-row": {
          if (!cmd.label) { msg = "Missing table name."; success = false; break; }
          const tn = findNode(cmd.label);
          if (!tn || tn.type !== "table") { msg = `"${cmd.label}" is not a table.`; success = false; break; }
          onAddTableRow(tn.id);
          msg = `Added row to "${cmd.label}"`;
          break;
        }

        // ── TABLE: ADD COLUMN ──
        case "table-add-column": {
          if (!cmd.label || !cmd.columnLabel) { msg = "Missing parameters."; success = false; break; }
          const tn = findNode(cmd.label);
          if (!tn || tn.type !== "table") { msg = `"${cmd.label}" is not a table.`; success = false; break; }
          onAddTableColumn(tn.id, cmd.columnLabel);
          msg = `Added column "${cmd.columnLabel}" to "${cmd.label}"`;
          break;
        }

        // ── TABLE: SET CELL ──
        case "table-set-cell": {
          if (!cmd.label || !cmd.value) { msg = "Missing parameters."; success = false; break; }
          const tn = findNode(cmd.label);
          if (!tn || tn.type !== "table" || !tn.tableData) { msg = `"${cmd.label}" is not a table.`; success = false; break; }

          // By row/col index
          if (cmd.rowIndex !== undefined && cmd.colIndex !== undefined) {
            const row = tn.tableData.rows[cmd.rowIndex];
            const col = tn.tableData.columns[cmd.colIndex];
            if (!row || !col) { msg = `Row ${(cmd.rowIndex || 0) + 1} or column ${(cmd.colIndex || 0) + 1} out of range.`; success = false; break; }
            onUpdateTableCell(tn.id, row.id, col.id, cmd.value);
            msg = `Set ${cmd.label}[${cmd.rowIndex + 1},${cmd.colIndex + 1}] = "${cmd.value}"`;
            break;
          }

          // By column name (fills first empty cell in that column)
          if (cmd.columnLabel) {
            const colName = cmd.columnLabel.toLowerCase();
            const col = tn.tableData.columns.find((c) => c.label.toLowerCase() === colName);
            if (!col) { msg = `Column "${cmd.columnLabel}" not found in "${cmd.label}".`; success = false; break; }
            // Find first row where this column is empty
            const emptyRow = tn.tableData.rows.find((r) => !r.cells[col.id] || r.cells[col.id].trim() === "");
            if (!emptyRow) { msg = `No empty rows in column "${cmd.columnLabel}".`; success = false; break; }
            onUpdateTableCell(tn.id, emptyRow.id, col.id, cmd.value);
            msg = `Filled "${cmd.label}" ${cmd.columnLabel} with "${cmd.value}"`;
            break;
          }

          msg = "Missing row/column specifier."; success = false;
          break;
        }

        // ── UNKNOWN ──
        case "unknown":
        default:
          msg = `Could not understand: "${transcript}". Say "help" for commands.`;
          success = false;
      }

      setLastResult(msg);
      setCommandHistory((prev) => [
        ...prev.slice(-49), // Keep last 50
        {
          id: Date.now(),
          transcript,
          result: msg,
          success,
          timestamp: Date.now(),
        },
      ]);
      return msg;
    },
    [
      parse,
      nodes,
      connectors,
      findNode,
      findConnector,
      getPlacementPosition,
      onAddNode,
      onMoveNode,
      onDeleteNodes,
      onUpdateNode,
      onUpdateNodeStyle,
      onResizeNode,
      onAddConnector,
      onUpdateConnector,
      onAddTableRow,
      onAddTableColumn,
      onUpdateTableCell,
      onSelectNodes,
      onClearSelection,
      onUndo,
      onRedo,
      onDuplicate,
    ],
  );

  return {
    executeCommand,
    lastResult,
    commandHistory,
    nodeInventory: nodes.map((n) => ({ id: n.id, label: n.voiceLabel || n.label, type: n.type })),
  };
}
