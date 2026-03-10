import { useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFtuxShell, type DockItem } from "@/lib/ftux-shell-context";
import { DOCK_TOOL_CATALOG } from "@/components/flow/FlowNodeRegistry";
import {
  FolderPlus,
  Pencil,
  Trash2,
  X,
  Check,
  GripVertical,
  RotateCcw,
  Sparkles,
  FileText,
  Users,
  ClipboardList,
  Wand2,
  Paintbrush,
  BookOpen,
  MessageCircleQuestion,
  BarChart3,
  Clock,
  ListCollapse,
  Brain,
  FileEdit,
  SquareDashedBottom,
  Mic,
  AudioLines,
  Youtube,
  Timer,
  CircuitBoard,
  Type,
  Filter,
  ToggleRight,
  GitBranch,
  Merge as MergeIcon,
  Share2,
  Wifi,
  Bell,
  Upload,
  UserCheck,
  BrainCircuit,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  FileText,
  Users,
  ClipboardList,
  Wand2,
  Paintbrush,
  BookOpen,
  MessageCircleQuestion,
  BarChart3,
  Clock,
  ListCollapse,
  Brain,
  FileEdit,
  SquareDashedBottom,
  Mic,
  AudioLines,
  Youtube,
  Timer,
  CircuitBoard,
  Type,
  Filter,
  ToggleRight,
  GitBranch,
  Merge: MergeIcon,
  Share2,
  Wifi,
  Bell,
  Upload,
  UserCheck,
  BrainCircuit,
};

interface ManageToolGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GroupData {
  name: string;
  items: DockItem[];
}

export function ManageToolGroupsDialog({ open, onOpenChange }: ManageToolGroupsDialogProps) {
  const { dockItems, setDockItems } = useFtuxShell();

  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Derive groups from dockItems
  const groups: GroupData[] = useMemo(() => {
    const groupMap = new Map<string, DockItem[]>();
    // Preserve order: gather first seen groups
    const order: string[] = [];
    for (const item of dockItems) {
      const g = item.group || "other";
      if (!groupMap.has(g)) {
        groupMap.set(g, []);
        order.push(g);
      }
      groupMap.get(g)!.push(item);
    }
    return order.map((name) => ({ name, items: groupMap.get(name)! }));
  }, [dockItems]);

  // Drag state
  const [dragToolId, setDragToolId] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  const handleDragStart = useCallback((toolId: string, e: React.DragEvent) => {
    setDragToolId(toolId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((groupName: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverGroup(groupName);
  }, []);

  const MAX_GROUP_SIZE = 10;

  const handleDrop = useCallback((targetGroup: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!dragToolId) return;

    // Enforce max group size
    const currentGroupItems = dockItems.filter(
      (item) => (item.group || "other") === targetGroup && item.toolId !== dragToolId,
    );
    if (currentGroupItems.length >= MAX_GROUP_SIZE) {
      setDragToolId(null);
      setDragOverGroup(null);
      return;
    }

    setDockItems(
      dockItems.map((item) =>
        item.toolId === dragToolId ? { ...item, group: targetGroup } : item,
      ),
    );
    setDragToolId(null);
    setDragOverGroup(null);
  }, [dragToolId, dockItems, setDockItems]);

  const handleDragEnd = useCallback(() => {
    setDragToolId(null);
    setDragOverGroup(null);
  }, []);

  // Rename group — guard against double-fire from Enter + blur
  const renameCommitted = useRef(false);

  const startRename = useCallback((groupName: string) => {
    renameCommitted.current = false;
    setEditingGroup(groupName);
    setEditValue(groupName);
    setTimeout(() => editInputRef.current?.select(), 0);
  }, []);

  const commitRename = useCallback(() => {
    if (renameCommitted.current) return;
    if (!editingGroup || !editValue.trim()) {
      setEditingGroup(null);
      return;
    }
    const newName = editValue.trim();
    if (newName === editingGroup) {
      setEditingGroup(null);
      return;
    }
    // Check for duplicates
    const existingNames = groups.map((g) => g.name);
    if (existingNames.includes(newName)) {
      setEditingGroup(null);
      return;
    }
    renameCommitted.current = true;
    // Also rename empty groups
    setEmptyGroups((prev) =>
      prev.map((n) => (n === editingGroup ? newName : n)),
    );
    setDockItems(
      dockItems.map((item) =>
        item.group === editingGroup ? { ...item, group: newName } : item,
      ),
    );
    setEditingGroup(null);
  }, [editingGroup, editValue, groups, dockItems, setDockItems]);

  // Add new group
  const handleAddGroup = useCallback(() => {
    const existingNames = groups.map((g) => g.name);
    let name = "New Group";
    let i = 2;
    while (existingNames.includes(name)) {
      name = `New Group ${i}`;
      i++;
    }
    // We need at least one item to create a group — we'll allow empty groups
    // by adding a placeholder entry, but actually let's just start rename
    // Create an empty group by adding nothing — groups derive from items
    // So we'll set a flag and render it. Actually, simplest: just prompt rename.
    // Since groups derive from items, we need a different approach.
    // We'll temporarily add a hidden item concept — or we can track empty groups separately.
    // Simplest: add the group name to dockGroupOrder if we track that.
    // For now, inform user they need to drag a tool into the new group.
    // Actually, let's just create a synthetic approach: we add a note.
    // Best approach: track empty group names in local state, merge with derived groups.
    setEmptyGroups((prev) => [...prev, name]);
    // Auto-start rename for the new group
    setTimeout(() => {
      setEditingGroup(name);
      setEditValue(name);
      setTimeout(() => editInputRef.current?.select(), 0);
    }, 50);
  }, [groups]);

  // Track empty groups (no items yet)
  const [emptyGroups, setEmptyGroups] = useState<string[]>([]);

  // Merged groups: derived + empty
  const allGroups: GroupData[] = useMemo(() => {
    const derived = [...groups];
    const derivedNames = new Set(derived.map((g) => g.name));
    for (const name of emptyGroups) {
      if (!derivedNames.has(name)) {
        derived.push({ name, items: [] });
      }
    }
    return derived;
  }, [groups, emptyGroups]);

  // Clean up empty groups that now have items
  // (emptyGroups entries that appear in derived groups can be removed)

  // Delete group — move items to first group
  const handleDeleteGroup = useCallback((groupName: string) => {
    const firstGroup = allGroups[0]?.name;
    if (!firstGroup || groupName === firstGroup) return;

    setDockItems(
      dockItems.map((item) =>
        item.group === groupName ? { ...item, group: firstGroup } : item,
      ),
    );
    setEmptyGroups((prev) => prev.filter((n) => n !== groupName));
  }, [allGroups, dockItems, setDockItems]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    const defaultItems: DockItem[] = DOCK_TOOL_CATALOG.map((entry) => ({
      toolId: entry.toolId as DockItem["toolId"],
      label: entry.label,
      icon: entry.iconName,
      group: entry.group,
      description: entry.description,
    }));
    setDockItems(defaultItems);
    setEmptyGroups([]);
  }, [setDockItems]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold">Manage Tool Groups</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={handleReset}
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {allGroups.map((group) => {
            const isDropTarget = dragOverGroup === group.name && dragToolId !== null;
            const isFirst = group === allGroups[0];

            return (
              <div
                key={group.name}
                className={`rounded-lg border transition-colors ${
                  isDropTarget
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/50 bg-muted/20"
                }`}
                onDragOver={(e) => handleDragOver(group.name, e)}
                onDrop={(e) => handleDrop(group.name, e)}
              >
                {/* Group header */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
                  {editingGroup === group.name ? (
                    <div className="flex items-center gap-1">
                      <input
                        ref={editInputRef}
                        className="text-xs font-semibold bg-transparent border border-primary/40 rounded px-1.5 py-0.5 outline-none w-32"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setEditingGroup(null);
                        }}
                        autoFocus
                      />
                      <button
                        className="p-0.5 rounded hover:bg-muted text-primary"
                        onClick={commitRename}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                        onClick={() => setEditingGroup(null)}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                      onDoubleClick={() => startRename(group.name)}
                      title="Double-click to rename"
                    >
                      {group.name}
                    </span>
                  )}

                  <div className="flex items-center gap-0.5">
                    <button
                      className="p-1 rounded hover:bg-muted text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      onClick={() => startRename(group.name)}
                      title="Rename group"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    {!isFirst && (
                      <button
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors"
                        onClick={() => handleDeleteGroup(group.name)}
                        title="Delete group (tools move to first group)"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Tools */}
                <div className="flex flex-wrap gap-1.5 p-2 min-h-[36px]">
                  {group.items.length >= MAX_GROUP_SIZE && (
                    <span className="w-full text-[9px] text-amber-500/60 px-1 mb-0.5">
                      Group full ({MAX_GROUP_SIZE}/{MAX_GROUP_SIZE})
                    </span>
                  )}
                  {group.items.length === 0 ? (
                    <span className="text-[10px] text-muted-foreground/50 italic px-1">
                      Drag tools here
                    </span>
                  ) : (
                    group.items.map((item) => {
                      const IconComponent = ICON_MAP[item.icon] || Sparkles;
                      const isDragging = dragToolId === item.toolId;

                      return (
                        <div
                          key={item.toolId}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs cursor-grab active:cursor-grabbing transition-all select-none ${
                            isDragging
                              ? "opacity-40 border-primary/30 bg-primary/5"
                              : "border-border/40 bg-background hover:border-border hover:bg-muted/50"
                          }`}
                          draggable
                          onDragStart={(e) => handleDragStart(item.toolId, e)}
                          onDragEnd={handleDragEnd}
                        >
                          <GripVertical className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                          <IconComponent className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-foreground/80 whitespace-nowrap">{item.label}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          {/* Add Group button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs gap-1.5 border-dashed"
            onClick={handleAddGroup}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Add Group
          </Button>

          <p className="text-[10px] text-muted-foreground/60 text-center">
            Drag tools between groups to reorganize. Double-click a group name to rename it.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
