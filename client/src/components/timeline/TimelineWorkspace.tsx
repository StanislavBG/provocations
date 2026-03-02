import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TimelineCanvas } from "./TimelineCanvas";
import { TimelineToolbar } from "./TimelineToolbar";
import { TimelineProperties } from "./TimelineProperties";
import { useTimelineState } from "./hooks/useTimelineState";
import {
  type TimelineEventType,
  type TimelineTagCategory,
  type TimelineEvent,
  autoZoomLevel,
} from "./types";
import { Save, Sparkles, Loader2, Globe, MapPin, Tag, Calendar } from "lucide-react";
import { LlmHoverButton, type ContextBlock, type SummaryItem } from "@/components/LlmHoverButton";

/** Summary of timeline state for external consumers (e.g. interview context) */
export interface TimelineSummary {
  dateRange?: { earliest: string; latest: string };
  places: string[];
  themes: string[];
  eventCount: number;
}

interface TimelineWorkspaceProps {
  /** Callback to save timeline JSON to context store */
  onSaveToContext?: (json: string, label: string) => void;
  /** Optional JSON string to auto-import on first mount (e.g. from "Map Notes to Timeline") */
  initialData?: string;
  /** Called when timeline events/tags change, reporting a summary for external context */
  onTimelineSummaryChange?: (summary: TimelineSummary) => void;
}

export function TimelineWorkspace({ onSaveToContext, initialData, onTimelineSummaryChange }: TimelineWorkspaceProps) {
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

  // ── Report timeline summary to parent when events/tags change ──
  useEffect(() => {
    if (!onTimelineSummaryChange) return;
    const events = timeline.events;
    const tags = timeline.tags;

    let dateRange: { earliest: string; latest: string } | undefined;
    if (events.length > 0) {
      const dates = events.map((e) => e.date).sort();
      dateRange = { earliest: dates[0], latest: dates[dates.length - 1] };
    }

    const places = tags.filter((t) => t.category === "place").map((t) => t.label);
    const themes = tags.filter((t) => t.category === "theme").map((t) => t.label);

    onTimelineSummaryChange({ dateRange, places, themes, eventCount: events.length });
  }, [timeline.events, timeline.tags, onTimelineSummaryChange]);

  // ── Import initial data on first mount ──
  const initialDataConsumedRef = useRef(false);
  useEffect(() => {
    if (initialData && !initialDataConsumedRef.current) {
      importTimeline(initialData);
      initialDataConsumedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-zoom to best fit when events change significantly ──
  const prevEventCountRef = useRef(0);
  useEffect(() => {
    const prev = prevEventCountRef.current;
    const curr = timeline.events.length;
    prevEventCountRef.current = curr;
    // Auto-zoom when going from empty to populated, or after bulk add (5+ new events)
    if (curr > 0 && (prev === 0 || curr - prev >= 5)) {
      setZoom(autoZoomLevel(timeline.events));
    }
  }, [timeline.events, setZoom]);

  // ── LLM preview: Discover Era button ──
  const discoverEraBlocks: ContextBlock[] = useMemo(() => {
    const eventTitlesChars = timeline.events.reduce((s, e) => s + e.title.length, 0);
    const places = timeline.tags.filter((t) => t.category === "place");
    const themes = timeline.tags.filter((t) => t.category === "theme");
    return [
      { label: "System Prompt", chars: 1500, color: "text-purple-400" },
      { label: "Date Range", chars: 40, color: "text-blue-400" },
      { label: "Places", chars: places.reduce((s, t) => s + t.label.length, 0), color: "text-green-400" },
      { label: "Themes", chars: themes.reduce((s, t) => s + t.label.length, 0), color: "text-amber-400" },
      { label: "Existing Events", chars: eventTitlesChars, color: "text-cyan-400" },
    ];
  }, [timeline.events, timeline.tags]);

  const discoverEraSummary: SummaryItem[] = useMemo(() => {
    const places = timeline.tags.filter((t) => t.category === "place");
    const themes = timeline.tags.filter((t) => t.category === "theme");
    const dates = timeline.events.map((e) => e.date).sort();
    return [
      { icon: <Globe className="w-3 h-3 text-blue-400" />, label: "Date Range", count: dates.length > 0 ? 1 : 0, detail: dates.length > 0 ? `${dates[0]} — ${dates[dates.length - 1]}` : undefined },
      { icon: <MapPin className="w-3 h-3 text-green-400" />, label: "Places", count: places.length },
      { icon: <Tag className="w-3 h-3 text-amber-400" />, label: "Themes", count: themes.length },
      { icon: <Calendar className="w-3 h-3 text-cyan-400" />, label: "Existing Events", count: timeline.events.length, detail: `excluded from results` },
    ];
  }, [timeline.events, timeline.tags]);

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

  // ── Discover Era mutation (LLM call for historical/cultural events) ──
  const discoverEraMutation = useMutation({
    mutationFn: async () => {
      if (timeline.events.length === 0) throw new Error("Add some events first so we know what era to discover");

      const dates = timeline.events.map((e) => e.date).sort();
      const dateRange = { earliest: dates[0], latest: dates[dates.length - 1] };
      const places = timeline.tags.filter((t) => t.category === "place").map((t) => t.label);
      const themes = timeline.tags.filter((t) => t.category === "theme").map((t) => t.label);
      const existingEventTitles = timeline.events.map((e) => e.title);

      const res = await apiRequest("POST", "/api/timeline/discover-era", {
        dateRange,
        places: places.length > 0 ? places : undefined,
        themes: themes.length > 0 ? themes : undefined,
        existingEventTitles,
      });
      return res.json() as Promise<{
        events: Omit<TimelineEvent, "id">[];
        suggestedTags: { label: string; category: TimelineTagCategory }[];
      }>;
    },
    onSuccess: (data) => {
      // Add new tags
      const newTagIds: Record<string, string> = {};
      for (const suggested of data.suggestedTags) {
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

      // Map tag labels to IDs and add events
      const eventsToAdd = data.events.map((e) => ({
        ...e,
        tags: (e.tags as string[])
          .map((tagLabel) => {
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
          title: "Era discovered",
          description: `Added ${eventsToAdd.length} historical event${eventsToAdd.length !== 1 ? "s" : ""} to spark your memories.`,
        });
      } else {
        toast({
          title: "No events found",
          description: "No historical events were generated for this era.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to discover era";
      toast({
        title: "Discovery failed",
        description: msg,
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

              {/* Discover Era — generate historical events for the timeline's date range */}
              <LlmHoverButton previewTitle="Discover Era" previewBlocks={discoverEraBlocks} previewSummary={discoverEraSummary} side="top" align="end">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  onClick={() => discoverEraMutation.mutate()}
                  disabled={discoverEraMutation.isPending || timeline.events.length === 0}
                >
                  {discoverEraMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Discovering...
                    </>
                  ) : (
                    <>
                      <Globe className="h-3.5 w-3.5" />
                      Discover Era
                    </>
                  )}
                </Button>
              </LlmHoverButton>
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
