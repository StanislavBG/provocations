import { useState, useCallback, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TimelineCanvas } from "./TimelineCanvas";
import { TimelineToolbar } from "./TimelineToolbar";
import { TimelineProperties } from "./TimelineProperties";
import { useTimelineState } from "./hooks/useTimelineState";
import type {
  TimelineEventType,
  TimelineTagCategory,
  TimelineEvent,
} from "./types";
import { Save, Sparkles } from "lucide-react";

interface TimelineWorkspaceProps {
  /** Callback to save timeline JSON to context store */
  onSaveToContext?: (json: string, label: string) => void;
}

export function TimelineWorkspace({ onSaveToContext }: TimelineWorkspaceProps) {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const {
    timeline,
    addEvent,
    addEvents,
    updateEvent,
    deleteEvents,
    addTag,
    updateTag,
    deleteTag,
    selectEvents,
    clearSelection,
    setZoom,
    setCenterDate,
    setFilter,
    toggleTagFilter,
    toggleTypeFilter,
    getFilteredEvents,
    undo,
    redo,
    exportTimeline,
    importTimeline,
  } = useTimelineState();

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (timeline.selectedEventIds.length > 0) {
          e.preventDefault();
          deleteEvents(timeline.selectedEventIds);
        }
        return;
      }

      if (e.key === "Escape") {
        clearSelection();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, deleteEvents, clearSelection, timeline.selectedEventIds]);

  // ── Transform notes mutation (LLM call) ──
  const transformMutation = useMutation({
    mutationFn: async (notes: string) => {
      const res = await apiRequest("POST", "/api/timeline/transform", {
        notes,
        existingTags: timeline.tags.map((t) => ({ id: t.id, label: t.label, category: t.category })),
      });
      return res.json() as Promise<{
        events: Omit<TimelineEvent, "id">[];
        suggestedTags: { label: string; category: TimelineTagCategory }[];
      }>;
    },
    onSuccess: (data) => {
      // Add any new suggested tags first
      const newTagIds: Record<string, string> = {};
      for (const suggested of data.suggestedTags) {
        // Skip if tag with same label already exists
        const existing = timeline.tags.find(
          (t) => t.label.toLowerCase() === suggested.label.toLowerCase(),
        );
        if (existing) {
          newTagIds[suggested.label.toLowerCase()] = existing.id;
        } else {
          const id = addTag(suggested.label, suggested.category);
          newTagIds[suggested.label.toLowerCase()] = id;
        }
      }

      // Add events (map tag labels to IDs)
      const eventsToAdd = data.events.map((e) => ({
        ...e,
        tags: e.tags
          .map((tagLabel) => {
            // Try matching by label to existing or new tags
            const existing = timeline.tags.find(
              (t) => t.label.toLowerCase() === tagLabel.toLowerCase(),
            );
            return existing?.id ?? newTagIds[tagLabel.toLowerCase()] ?? null;
          })
          .filter(Boolean) as string[],
      }));

      if (eventsToAdd.length > 0) {
        addEvents(eventsToAdd);
        toast({
          title: "Events extracted",
          description: `Added ${eventsToAdd.length} event${eventsToAdd.length !== 1 ? "s" : ""} to the timeline.`,
        });
      } else {
        toast({
          title: "No events found",
          description: "The AI couldn't extract any timeline events from the provided notes.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Transform failed",
        description: "Failed to transform notes into timeline events. Try again.",
        variant: "destructive",
      });
    },
  });

  // ── Handlers ──

  const handleAddManualEvent = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    addEvent({
      type: "event",
      title: "New Event",
      description: "",
      date: today,
      dateConfidence: "exact",
      source: "manual",
      tags: [],
    });
  }, [addEvent]);

  const handleExport = useCallback(() => {
    const json = exportTimeline();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "timeline.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Timeline saved as JSON file." });
  }, [exportTimeline, toast]);

  const handleSaveToContext = useCallback(() => {
    if (!onSaveToContext) return;
    const json = exportTimeline();
    onSaveToContext(json, "Timeline Data");
    toast({ title: "Saved", description: "Timeline saved to Context Store." });
  }, [onSaveToContext, exportTimeline, toast]);

  const handleDeleteSelected = useCallback(() => {
    if (timeline.selectedEventIds.length > 0) {
      deleteEvents(timeline.selectedEventIds);
    }
  }, [deleteEvents, timeline.selectedEventIds]);

  const selectedEvent = useMemo(() => {
    if (timeline.selectedEventIds.length !== 1) return null;
    return timeline.events.find((e) => e.id === timeline.selectedEventIds[0]) ?? null;
  }, [timeline.events, timeline.selectedEventIds]);

  const filteredEvents = getFilteredEvents();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <TimelineToolbar
        tags={timeline.tags}
        filter={timeline.filter}
        zoom={timeline.viewport.zoom}
        selectedCount={timeline.selectedEventIds.length}
        eventCount={timeline.events.length}
        onAddEvent={handleAddManualEvent}
        onAddTag={(label, category) => addTag(label, category)}
        onDeleteSelected={handleDeleteSelected}
        onUndo={undo}
        onRedo={redo}
        onZoomChange={setZoom}
        onToggleTagFilter={toggleTagFilter}
        onToggleTypeFilter={toggleTypeFilter}
        onSearchChange={(text) => setFilter({ searchText: text })}
        onExport={handleExport}
        onImport={importTimeline}
      />

      {/* Main content: Canvas + Properties */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Timeline canvas */}
        <ResizablePanel defaultSize={75} minSize={40}>
          <div className="flex flex-col h-full">
            <TimelineCanvas
              events={filteredEvents}
              tags={timeline.tags}
              zoom={timeline.viewport.zoom}
              selectedEventIds={timeline.selectedEventIds}
              onSelectEvent={(id, additive) => selectEvents([id], additive)}
              onClearSelection={clearSelection}
            />

            {/* Bottom action bar */}
            <div className="flex items-center gap-2 px-3 py-2 border-t bg-card/50">
              {onSaveToContext && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleSaveToContext}
                >
                  <Save className="h-3.5 w-3.5" />
                  Save to Context
                </Button>
              )}
            </div>
          </div>
        </ResizablePanel>

        {/* Properties panel */}
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <TimelineProperties
            event={selectedEvent}
            tags={timeline.tags}
            onUpdateEvent={updateEvent}
            onDeleteEvent={(id) => {
              deleteEvents([id]);
              clearSelection();
            }}
            onClose={clearSelection}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
