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
  // Ref to track current target without triggering re-renders on every dragover event
  const dragOverRef = useRef<{ panel: "left" | "right"; index: number } | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, id: string, from: "left" | "right") => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    setDragItem({ id, from });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, panel: "left" | "right", index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    // Only update React state if the target actually changed — prevents re-render storm
    if (dragOverRef.current?.panel === panel && dragOverRef.current?.index === index) return;
    dragOverRef.current = { panel, index };
    setDragOverTarget({ panel, index });
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the panel container (not moving between children)
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    if (relatedTarget && currentTarget.contains(relatedTarget)) return;
    dragOverRef.current = null;
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
      const adjustedIndex = removeIdx < targetIndex ? targetIndex - 1 : targetIndex;
      sourceList.splice(adjustedIndex, 0, id);
      setSource(sourceList);
    } else {
      // Move across panels
      setSource(sourceList);
      const cleanTarget = targetPanel === "left"
        ? leftTabs.filter((t) => t !== id)
        : rightTabs.filter((t) => t !== id);
      cleanTarget.splice(targetIndex, 0, id);
      if (targetPanel === "left") setLeftTabs(cleanTarget);
      else setRightTabs(cleanTarget);
    }

    setDragItem(null);
    setDragOverTarget(null);
    dragOverRef.current = null;
  }, [dragItem, leftTabs, rightTabs]);

  const handleDragEnd = useCallback(() => {
    setDragItem(null);
    setDragOverTarget(null);
    dragOverRef.current = null;
  }, []);

  const moveTab = useCallback((id: string, from: "left" | "right") => {
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
    const showDropAbove = dragOverTarget?.panel === panel && dragOverTarget?.index === index && dragItem && dragItem.id !== id;

    return (
      <div
        key={id}
        draggable
        onDragStart={(e) => handleDragStart(e, id, panel)}
        onDragOver={(e) => handleDragOver(e, panel, index)}
        onDrop={(e) => handleDrop(e, panel, index)}
        onDragEnd={handleDragEnd}
        className={`relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing group select-none ${
          isDragging
            ? "opacity-30 scale-95"
            : "hover:bg-muted/60"
        }`}
      >
        {/* Drop indicator — uses border-top instead of inserting a DOM element */}
        {showDropAbove && (
          <div className="absolute top-0 left-2 right-2 h-0.5 bg-primary rounded-full -translate-y-1/2 pointer-events-none" />
        )}
        <GripVertical className="w-3 h-3 text-muted-foreground/50 shrink-0" />
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
        <span className="text-xs font-medium flex-1">{def?.label || id}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            moveTab(id, panel);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
          title={`Move to ${panel === "left" ? "right" : "left"} panel`}
        >
          <ArrowLeftRight className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>
    );
  };

  const renderPanel = (tabs: string[], panel: "left" | "right", label: string) => {
    const isLeft = panel === "left";
    const showDropAtEnd = dragOverTarget?.panel === panel && dragOverTarget?.index === tabs.length && dragItem;

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
          className="rounded-lg border border-dashed border-muted-foreground/20 bg-muted/10 p-1 min-h-[120px]"
          onDragOver={(e) => {
            e.preventDefault();
            // Only handle if not over a specific tab item (those handle themselves)
            const target = e.target as HTMLElement;
            if (target === e.currentTarget || target.closest("[data-panel-drop-zone]")) {
              handleDragOver(e, panel, tabs.length);
            }
          }}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, panel, tabs.length)}
        >
          {tabs.map((id, idx) => renderTabItem(id, panel, idx))}
          {tabs.length === 0 && (
            <div
              data-panel-drop-zone
              className="flex items-center justify-center h-[100px] text-[10px] text-muted-foreground/50"
            >
              Drag tabs here
            </div>
          )}
          {/* Drop indicator at end of list */}
          {showDropAtEnd && (
            <div className="h-0.5 bg-primary rounded-full mx-2 my-1 pointer-events-none" />
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
