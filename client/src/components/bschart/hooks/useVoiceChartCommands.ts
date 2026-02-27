import { useCallback, useRef, useState } from "react";
import type { BSNodeType, BSNode, BSPortSide } from "../types";
import { DEFAULT_DIMENSIONS } from "../types";

/**
 * Voice command parser for chart design.
 * Supports natural-language commands like:
 * - "add table called Users"
 * - "add diamond called Is Valid"
 * - "connect Users to Is Valid"
 * - "move Users right of Is Valid"
 * - "label Users to Is Valid with validates"
 * - "delete Users"
 * - "rename Is Valid to Check Auth"
 */

interface VoiceChartCommandsProps {
  nodes: BSNode[];
  onAddNode: (type: BSNodeType, x: number, y: number, label?: string) => string;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onDeleteNodes: (nodeIds: string[]) => void;
  onUpdateNode: (nodeId: string, updates: Partial<BSNode>) => void;
  onAddConnector: (fromNodeId: string, fromPort: BSPortSide, toNodeId: string, toPort: BSPortSide, label?: string) => string;
  onUpdateConnector: (connectorId: string, updates: { label?: string }) => void;
}

interface ParsedCommand {
  type: "add" | "connect" | "move" | "delete" | "rename" | "label" | "unknown";
  nodeType?: BSNodeType;
  label?: string;
  from?: string;
  to?: string;
  direction?: "left" | "right" | "above" | "below";
  relativeTo?: string;
  connectorLabel?: string;
}

const NODE_TYPE_ALIASES: Record<string, BSNodeType> = {
  table: "table",
  rectangle: "rectangle",
  rect: "rectangle",
  box: "rectangle",
  process: "rectangle",
  "rounded rect": "rounded-rect",
  "rounded rectangle": "rounded-rect",
  "round rect": "rounded-rect",
  service: "rounded-rect",
  diamond: "diamond",
  decision: "diamond",
  condition: "diamond",
  text: "text",
  label: "text",
  annotation: "text",
  note: "text",
  badge: "badge",
  tag: "badge",
};

const DIRECTION_ALIASES: Record<string, "left" | "right" | "above" | "below"> = {
  left: "left",
  "left of": "left",
  "to the left of": "left",
  right: "right",
  "right of": "right",
  "to the right of": "right",
  above: "above",
  "above of": "above",
  over: "above",
  below: "below",
  "below of": "below",
  under: "below",
};

export function useVoiceChartCommands({
  nodes,
  onAddNode,
  onMoveNode,
  onDeleteNodes,
  onUpdateNode,
  onAddConnector,
  onUpdateConnector,
}: VoiceChartCommandsProps) {
  const [lastResult, setLastResult] = useState<string>("");

  const findNodeByVoiceLabel = useCallback(
    (name: string): BSNode | undefined => {
      const lower = name.toLowerCase().trim();
      return nodes.find(
        (n) =>
          n.voiceLabel.toLowerCase() === lower ||
          n.label.toLowerCase() === lower,
      );
    },
    [nodes],
  );

  const parseCommand = useCallback(
    (transcript: string): ParsedCommand => {
      const text = transcript.toLowerCase().trim();

      // ── ADD: "add <type> called <name>" or "add <type> <name>" ──
      const addMatch = text.match(
        /^add\s+([\w\s]+?)(?:\s+called\s+|\s+named\s+|\s+)(.+)$/i,
      );
      if (addMatch) {
        const typeStr = addMatch[1].trim();
        const label = addMatch[2].trim();
        const nodeType = NODE_TYPE_ALIASES[typeStr];
        if (nodeType) {
          return { type: "add", nodeType, label };
        }
      }

      // Simpler add: "add table" or "add diamond"
      const simpleAdd = text.match(/^add\s+([\w\s]+?)$/i);
      if (simpleAdd) {
        const typeStr = simpleAdd[1].trim();
        const nodeType = NODE_TYPE_ALIASES[typeStr];
        if (nodeType) {
          return { type: "add", nodeType };
        }
      }

      // ── CONNECT: "connect <from> to <to>" or "connect <from> to <to> with <label>" ──
      const connectMatch = text.match(
        /^connect\s+(.+?)\s+to\s+(.+?)(?:\s+with\s+(.+))?$/i,
      );
      if (connectMatch) {
        return {
          type: "connect",
          from: connectMatch[1].trim(),
          to: connectMatch[2].trim(),
          connectorLabel: connectMatch[3]?.trim(),
        };
      }

      // ── MOVE: "move <node> <direction> <relativeTo>" ──
      const moveMatch = text.match(
        /^move\s+(.+?)\s+(left of|right of|above|below|to the left of|to the right of|over|under)\s+(.+)$/i,
      );
      if (moveMatch) {
        const direction = DIRECTION_ALIASES[moveMatch[2].toLowerCase()];
        return {
          type: "move",
          label: moveMatch[1].trim(),
          direction,
          relativeTo: moveMatch[3].trim(),
        };
      }

      // ── DELETE: "delete <name>" or "remove <name>" ──
      const deleteMatch = text.match(/^(?:delete|remove)\s+(.+)$/i);
      if (deleteMatch) {
        return { type: "delete", label: deleteMatch[1].trim() };
      }

      // ── RENAME: "rename <old> to <new>" ──
      const renameMatch = text.match(/^rename\s+(.+?)\s+to\s+(.+)$/i);
      if (renameMatch) {
        return {
          type: "rename",
          from: renameMatch[1].trim(),
          to: renameMatch[2].trim(),
        };
      }

      // ── LABEL connector: "label <from> to <to> with <label>" ──
      const labelMatch = text.match(
        /^label\s+(.+?)\s+to\s+(.+?)\s+(?:with|as)\s+(.+)$/i,
      );
      if (labelMatch) {
        return {
          type: "label",
          from: labelMatch[1].trim(),
          to: labelMatch[2].trim(),
          connectorLabel: labelMatch[3].trim(),
        };
      }

      return { type: "unknown" };
    },
    [],
  );

  const executeCommand = useCallback(
    (transcript: string): string => {
      const cmd = parseCommand(transcript);

      switch (cmd.type) {
        case "add": {
          if (!cmd.nodeType) return "Could not determine shape type.";
          // Place near center or offset from last node
          const lastNode = nodes[nodes.length - 1];
          const x = lastNode ? lastNode.x + lastNode.width + 40 : 100;
          const y = lastNode ? lastNode.y : 100;
          const id = onAddNode(cmd.nodeType, x, y, cmd.label);
          const msg = `Added ${cmd.nodeType}${cmd.label ? ` "${cmd.label}"` : ""}`;
          setLastResult(msg);
          return msg;
        }

        case "connect": {
          if (!cmd.from || !cmd.to) return "Missing source or target.";
          const fromNode = findNodeByVoiceLabel(cmd.from);
          const toNode = findNodeByVoiceLabel(cmd.to);
          if (!fromNode) return `Cannot find node "${cmd.from}"`;
          if (!toNode) return `Cannot find node "${cmd.to}"`;
          onAddConnector(fromNode.id, "right", toNode.id, "left", cmd.connectorLabel);
          const msg = `Connected ${cmd.from} → ${cmd.to}${cmd.connectorLabel ? ` (${cmd.connectorLabel})` : ""}`;
          setLastResult(msg);
          return msg;
        }

        case "move": {
          if (!cmd.label || !cmd.direction || !cmd.relativeTo) return "Missing move parameters.";
          const moveNode = findNodeByVoiceLabel(cmd.label);
          const refNode = findNodeByVoiceLabel(cmd.relativeTo);
          if (!moveNode) return `Cannot find node "${cmd.label}"`;
          if (!refNode) return `Cannot find node "${cmd.relativeTo}"`;
          const gap = 40;
          let newX = refNode.x;
          let newY = refNode.y;
          switch (cmd.direction) {
            case "right":
              newX = refNode.x + refNode.width + gap;
              newY = refNode.y;
              break;
            case "left":
              newX = refNode.x - moveNode.width - gap;
              newY = refNode.y;
              break;
            case "above":
              newX = refNode.x;
              newY = refNode.y - moveNode.height - gap;
              break;
            case "below":
              newX = refNode.x;
              newY = refNode.y + refNode.height + gap;
              break;
          }
          onMoveNode(moveNode.id, newX, newY);
          const msg = `Moved ${cmd.label} ${cmd.direction} ${cmd.relativeTo}`;
          setLastResult(msg);
          return msg;
        }

        case "delete": {
          if (!cmd.label) return "Missing node name.";
          const delNode = findNodeByVoiceLabel(cmd.label);
          if (!delNode) return `Cannot find node "${cmd.label}"`;
          onDeleteNodes([delNode.id]);
          const msg = `Deleted "${cmd.label}"`;
          setLastResult(msg);
          return msg;
        }

        case "rename": {
          if (!cmd.from || !cmd.to) return "Missing rename parameters.";
          const renNode = findNodeByVoiceLabel(cmd.from);
          if (!renNode) return `Cannot find node "${cmd.from}"`;
          onUpdateNode(renNode.id, { label: cmd.to, voiceLabel: cmd.to });
          const msg = `Renamed "${cmd.from}" to "${cmd.to}"`;
          setLastResult(msg);
          return msg;
        }

        case "unknown":
        default:
          setLastResult("Could not understand command.");
          return "Could not understand command. Try: add table called Users, connect Users to Orders, move Orders right of Users";
      }
    },
    [
      parseCommand,
      nodes,
      findNodeByVoiceLabel,
      onAddNode,
      onMoveNode,
      onDeleteNodes,
      onUpdateNode,
      onAddConnector,
    ],
  );

  return {
    executeCommand,
    lastResult,
  };
}
