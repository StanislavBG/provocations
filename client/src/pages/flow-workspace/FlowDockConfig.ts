/**
 * FlowDockConfig — Dock item configuration for the Flow workspace (E7 extraction).
 *
 * Extracted from FlowWorkspace.tsx to reduce monolith size.
 * This module derives dock items from the single-source-of-truth DOCK_TOOL_CATALOG.
 */

import type { DockItem, ToolId, FtuxShellConfig } from "@/lib/ftux-shell-context";
import { DEFAULT_SHELL_CONFIG } from "@/lib/ftux-shell-context";
import { DOCK_TOOL_CATALOG } from "@/components/flow/FlowNodeRegistry";

export const FLOW_DOCK_ITEMS: DockItem[] = DOCK_TOOL_CATALOG.map((entry) => ({
  toolId: entry.toolId as ToolId,
  label: entry.label,
  icon: entry.iconName,
  group: entry.group,
  description: entry.description,
}));

export const FLOW_SHELL_CONFIG: FtuxShellConfig = {
  ...DEFAULT_SHELL_CONFIG,
  dockItems: FLOW_DOCK_ITEMS,
  dockShowLabels: true,
  dockSnapped: true,
  dockButtonSize: "large",
  dockPosition: "bottom",
  tourCompleted: true,
  tipsEnabled: false,
};
