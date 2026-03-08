export interface ToolGroupItem {
  toolId: string;
  label: string;
}

export interface ToolGroup {
  id: string;
  label: string;
  items: ToolGroupItem[];
  color?: string;
}

const STORAGE_KEY = "provocations-tool-groups";

export const DEFAULT_TOOL_GROUPS: ToolGroup[] = [
  {
    id: "gather",
    label: "Gather",
    items: [
      { toolId: "context", label: "Context" },
      { toolId: "upload", label: "Upload" },
      { toolId: "youtube", label: "YouTube" },
    ],
  },
  {
    id: "workshop",
    label: "Workshop",
    items: [
      { toolId: "research", label: "Research" },
      { toolId: "interview", label: "Interview" },
    ],
  },
  {
    id: "build",
    label: "Build",
    items: [
      { toolId: "llm", label: "Text Mods" },
      { toolId: "painter", label: "Painter" },
      { toolId: "social-post", label: "Social" },
      { toolId: "timeline", label: "Timeline" },
    ],
  },
  {
    id: "logic",
    label: "Logic",
    items: [
      { toolId: "logic", label: "Logic" },
      { toolId: "trigger", label: "Trigger" },
      { toolId: "notification", label: "Notify" },
      { toolId: "store", label: "Store" },
    ],
  },
];

export function getToolGroups(): ToolGroup[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* fall through */ }
  return DEFAULT_TOOL_GROUPS;
}

export function saveToolGroups(groups: ToolGroup[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

export function resetToolGroups(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function moveToolBetweenGroups(
  groups: ToolGroup[],
  toolId: string,
  fromGroupId: string,
  toGroupId: string,
  toIndex?: number,
): ToolGroup[] {
  const updated = groups.map(g => ({ ...g, items: [...g.items] }));
  const fromGroup = updated.find(g => g.id === fromGroupId);
  const toGroup = updated.find(g => g.id === toGroupId);
  if (!fromGroup || !toGroup) return groups;

  const itemIdx = fromGroup.items.findIndex(i => i.toolId === toolId);
  if (itemIdx === -1) return groups;

  const [item] = fromGroup.items.splice(itemIdx, 1);
  const insertAt = toIndex ?? toGroup.items.length;
  toGroup.items.splice(insertAt, 0, item);

  return updated;
}

export function addToolGroup(groups: ToolGroup[], label: string): ToolGroup[] {
  const id = `custom-${Date.now()}`;
  return [...groups, { id, label, items: [] }];
}

export function removeToolGroup(groups: ToolGroup[], groupId: string): ToolGroup[] {
  const group = groups.find(g => g.id === groupId);
  if (!group) return groups;
  const remaining = groups.filter(g => g.id !== groupId);
  if (remaining.length > 0 && group.items.length > 0) {
    remaining[0] = { ...remaining[0], items: [...remaining[0].items, ...group.items] };
  }
  return remaining;
}

export function renameToolGroup(groups: ToolGroup[], groupId: string, newLabel: string): ToolGroup[] {
  return groups.map(g => g.id === groupId ? { ...g, label: newLabel } : g);
}
