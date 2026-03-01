import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  MessageSquare,
  Video,
  Sparkles,
  MessageCircleQuestion,
  ClipboardList,
  Users,
  Wand2,
  Paintbrush,
  GripVertical,
  ArrowLeftRight,
  PanelLeft,
  PanelRight,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import {
  ALL_PANEL_TABS,
  DEFAULT_PANEL_LAYOUT,
  type PanelLayoutConfig,
} from "@/hooks/use-panel-layout";

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  MessageSquare,
  Video,
  Sparkles,
  MessageCircleQuestion,
  ClipboardList,
  Users,
  Wand2,
  Paintbrush,
};

function getTabDef(id: string) {
  return ALL_PANEL_TABS.find((t) => t.id === id);
}

function getTabIcon(id: string): LucideIcon | null {
  const def = getTabDef(id);
  return def ? ICON_MAP[def.icon] ?? null : null;
}

interface PanelLayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panelLayout: PanelLayoutConfig;
  onSave: (layout: PanelLayoutConfig) => void;
}

export function PanelLayoutDialog({
  open,
  onOpenChange,
  panelLayout,
  onSave,
}: PanelLayoutDialogProps) {
  const [leftTabs, setLeftTabs] = useState<string[]>(panelLayout.leftTabs);
  const [rightTabs, setRightTabs] = useState<string[]>(panelLayout.rightTabs);

  // Reset local state when dialog opens
  const prevOpenRef = useRef(open);
  if (open && !prevOpenRef.current) {
    // Dialog just opened — sync from props
    setLeftTabs(panelLayout.leftTabs);
    setRightTabs(panelLayout.rightTabs);
  }
  prevOpenRef.current = open;

  // ── Drag state ──
  const [dragItem, setDragItem] = useState<{ id: string; from: "left" | "right" } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ panel: "left" | "right"; index: number } | null>(null);

  const handleDragStart = useCallback((id: string, from: "left" | "right") => {
    setDragItem({ id, from });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, panel: "left" | "right", index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget({ panel, index });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetPanel: "left" | "right", targetIndex: number) => {
    e.preventDefault();
    if (!dragItem) return;

    const { id, from } = dragItem;

    // Remove from source
    const sourceList = from === "left" ? [...leftTabs] : [...rightTabs];
    const setSource = from === "left" ? setLeftTabs : setRightTabs;
    const removeIdx = sourceList.indexOf(id);
    if (removeIdx >= 0) sourceList.splice(removeIdx, 1);

    if (from === targetPanel) {
      // Reorder within same panel
      // Adjust target index if item was above the target in the same list
      const adjustedIndex = removeIdx < targetIndex ? targetIndex - 1 : targetIndex;
      sourceList.splice(adjustedIndex, 0, id);
      setSource(sourceList);
    } else {
      // Move across panels
      setSource(sourceList);
      const targetList = targetPanel === "left" ? [...leftTabs] : [...rightTabs];
      // If we just removed from targetList's sibling, the state may not reflect it yet
      // so we work with the current state
      if (from === targetPanel) {
        // Already handled above
      } else {
        // Remove from source was already done above, now insert into target
        const cleanTarget = targetPanel === "left"
          ? leftTabs.filter((t) => t !== id)
          : rightTabs.filter((t) => t !== id);
        cleanTarget.splice(targetIndex, 0, id);
        if (targetPanel === "left") setLeftTabs(cleanTarget);
        else setRightTabs(cleanTarget);
      }
    }

    setDragItem(null);
    setDragOverTarget(null);
  }, [dragItem, leftTabs, rightTabs]);

  const handleDragEnd = useCallback(() => {
    setDragItem(null);
    setDragOverTarget(null);
  }, []);

  const moveTab = useCallback((id: string, from: "left" | "right") => {
    const target = from === "left" ? "right" : "left";
    if (from === "left") {
      setLeftTabs((prev) => prev.filter((t) => t !== id));
      setRightTabs((prev) => [...prev, id]);
    } else {
      setRightTabs((prev) => prev.filter((t) => t !== id));
      setLeftTabs((prev) => [...prev, id]);
    }
  }, []);

  const handleReset = useCallback(() => {
    setLeftTabs(DEFAULT_PANEL_LAYOUT.leftTabs);
    setRightTabs(DEFAULT_PANEL_LAYOUT.rightTabs);
  }, []);

  const handleSave = useCallback(() => {
    onSave({ leftTabs, rightTabs });
    onOpenChange(false);
  }, [leftTabs, rightTabs, onSave, onOpenChange]);

  const renderTabItem = (id: string, panel: "left" | "right", index: number) => {
    const def = getTabDef(id);
    const Icon = getTabIcon(id);
    const isDragging = dragItem?.id === id;
    const isDropTarget = dragOverTarget?.panel === panel && dragOverTarget?.index === index;

    return (
      <div key={id}>
        {isDropTarget && (
          <div className="h-0.5 bg-primary rounded-full mx-2 -my-0.5 transition-all" />
        )}
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", id);
            handleDragStart(id, panel);
          }}
          onDragOver={(e) => handleDragOver(e, panel, index)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-all group ${
            isDragging
              ? "opacity-30 scale-95"
              : "hover:bg-muted/60"
          }`}
        >
          <GripVertical className="w-3 h-3 text-muted-foreground/50 shrink-0" />
          {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="text-xs font-medium flex-1">{def?.label || id}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              moveTab(id, panel);
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-all"
            title={`Move to ${panel === "left" ? "right" : "left"} panel`}
          >
            <ArrowLeftRight className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  };

  const renderPanel = (tabs: string[], panel: "left" | "right", label: string) => {
    const isLeft = panel === "left";
    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
          {isLeft ? (
            <PanelLeft className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <PanelRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="text-[9px] text-muted-foreground/60 ml-auto">
            {tabs.length} tab{tabs.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div
          className="space-y-0.5 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/10 p-1 min-h-[120px]"
          onDragOver={(e) => {
            e.preventDefault();
            if (dragOverTarget?.panel !== panel || dragOverTarget?.index !== tabs.length) {
              setDragOverTarget({ panel, index: tabs.length });
            }
          }}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, panel, tabs.length)}
        >
          {tabs.map((id, idx) => renderTabItem(id, panel, idx))}
          {tabs.length === 0 && (
            <div className="flex items-center justify-center h-[100px] text-[10px] text-muted-foreground/50">
              Drag tabs here
            </div>
          )}
          {dragOverTarget?.panel === panel && dragOverTarget?.index === tabs.length && dragItem && (
            <div className="h-0.5 bg-primary rounded-full mx-2 my-0.5 transition-all" />
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Panel Layout</DialogTitle>
          <DialogDescription className="text-xs">
            Drag tabs to reorder or move between panels. Click the arrow to switch a tab between panels.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 mt-2">
          {renderPanel(leftTabs, "left", "Left Panel")}
          {renderPanel(rightTabs, "right", "Right Panel")}
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs gap-1 text-muted-foreground"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} className="text-xs">
              Save Layout
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
