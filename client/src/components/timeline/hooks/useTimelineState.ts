import { useState, useCallback, useRef } from "react";
import { generateId } from "@/lib/utils";
import {
  type Timeline,
  type TimelineEvent,
  type TimelineTag,
  type TimelineEventType,
  type TimelineTagCategory,
  type TimelineZoomLevel,
  type TimelineFilter,
  EMPTY_TIMELINE,
  TAG_CATEGORY_CONFIG,
  sortEventsByDate,
} from "../types";

const MAX_HISTORY = 50;

export function useTimelineState() {
  const [timeline, setTimeline] = useState<Timeline>(EMPTY_TIMELINE);
  const historyRef = useRef<Timeline[]>([]);
  const futureRef = useRef<Timeline[]>([]);

  // ── History management ──

  const pushHistory = useCallback(() => {
    setTimeline((current) => {
      historyRef.current = [...historyRef.current.slice(-MAX_HISTORY), current];
      futureRef.current = [];
      return current;
    });
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    setTimeline((current) => {
      futureRef.current = [current, ...futureRef.current];
      const prev = historyRef.current[historyRef.current.length - 1];
      historyRef.current = historyRef.current.slice(0, -1);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    setTimeline((current) => {
      historyRef.current = [...historyRef.current, current];
      const next = futureRef.current[0];
      futureRef.current = futureRef.current.slice(1);
      return next;
    });
  }, []);

  // ── Event operations ──

  const addEvent = useCallback((event: Omit<TimelineEvent, "id">) => {
    pushHistory();
    const newEvent: TimelineEvent = { ...event, id: generateId("evt") };
    setTimeline((prev) => ({
      ...prev,
      events: sortEventsByDate([...prev.events, newEvent]),
    }));
    return newEvent.id;
  }, [pushHistory]);

  const updateEvent = useCallback((eventId: string, updates: Partial<Omit<TimelineEvent, "id">>) => {
    pushHistory();
    setTimeline((prev) => ({
      ...prev,
      events: sortEventsByDate(
        prev.events.map((e) => (e.id === eventId ? { ...e, ...updates } : e)),
      ),
    }));
  }, [pushHistory]);

  const deleteEvents = useCallback((eventIds: string[]) => {
    pushHistory();
    const idSet = new Set(eventIds);
    setTimeline((prev) => ({
      ...prev,
      events: prev.events.filter((e) => !idSet.has(e.id)),
      selectedEventIds: prev.selectedEventIds.filter((id) => !idSet.has(id)),
    }));
  }, [pushHistory]);

  const addEvents = useCallback((events: Omit<TimelineEvent, "id">[]) => {
    pushHistory();
    const newEvents = events.map((e) => ({ ...e, id: generateId("evt") }));
    setTimeline((prev) => ({
      ...prev,
      events: sortEventsByDate([...prev.events, ...newEvents]),
    }));
    return newEvents.map((e) => e.id);
  }, [pushHistory]);

  // ── Tag operations ──

  const addTag = useCallback((label: string, category: TimelineTagCategory, color?: string) => {
    pushHistory();
    const newTag: TimelineTag = {
      id: generateId("tag"),
      label,
      category,
      color: color ?? TAG_CATEGORY_CONFIG[category].defaultColor,
    };
    setTimeline((prev) => ({
      ...prev,
      tags: [...prev.tags, newTag],
    }));
    return newTag.id;
  }, [pushHistory]);

  const updateTag = useCallback((tagId: string, updates: Partial<Omit<TimelineTag, "id">>) => {
    pushHistory();
    setTimeline((prev) => ({
      ...prev,
      tags: prev.tags.map((t) => (t.id === tagId ? { ...t, ...updates } : t)),
    }));
  }, [pushHistory]);

  const deleteTag = useCallback((tagId: string) => {
    pushHistory();
    setTimeline((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t.id !== tagId),
      events: prev.events.map((e) => ({
        ...e,
        tags: e.tags.filter((t) => t !== tagId),
      })),
    }));
  }, [pushHistory]);

  // ── Selection ──

  const selectEvents = useCallback((eventIds: string[], additive = false) => {
    setTimeline((prev) => ({
      ...prev,
      selectedEventIds: additive
        ? Array.from(new Set([...prev.selectedEventIds, ...eventIds]))
        : eventIds,
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setTimeline((prev) => ({
      ...prev,
      selectedEventIds: [],
    }));
  }, []);

  // ── Viewport ──

  const setZoom = useCallback((zoom: TimelineZoomLevel) => {
    setTimeline((prev) => ({
      ...prev,
      viewport: { ...prev.viewport, zoom },
    }));
  }, []);

  const setCenterDate = useCallback((centerDate: string) => {
    setTimeline((prev) => ({
      ...prev,
      viewport: { ...prev.viewport, centerDate },
    }));
  }, []);

  const setScrollY = useCallback((scrollY: number) => {
    setTimeline((prev) => ({
      ...prev,
      viewport: { ...prev.viewport, scrollY },
    }));
  }, []);

  // ── Filter ──

  const setFilter = useCallback((filter: Partial<TimelineFilter>) => {
    setTimeline((prev) => ({
      ...prev,
      filter: { ...prev.filter, ...filter },
    }));
  }, []);

  const toggleTagFilter = useCallback((tagId: string) => {
    setTimeline((prev) => {
      const activeTags = prev.filter.activeTags.includes(tagId)
        ? prev.filter.activeTags.filter((t) => t !== tagId)
        : [...prev.filter.activeTags, tagId];
      return { ...prev, filter: { ...prev.filter, activeTags } };
    });
  }, []);

  const toggleTypeFilter = useCallback((type: TimelineEventType) => {
    setTimeline((prev) => {
      const activeTypes = prev.filter.activeTypes.includes(type)
        ? prev.filter.activeTypes.filter((t) => t !== type)
        : [...prev.filter.activeTypes, type];
      return { ...prev, filter: { ...prev.filter, activeTypes } };
    });
  }, []);

  // ── Filtered events (computed) ──

  const getFilteredEvents = useCallback((): TimelineEvent[] => {
    const { activeTags, activeTypes, startDate, endDate, searchText } = timeline.filter;

    return timeline.events.filter((event) => {
      // Tag filter
      if (activeTags.length > 0 && !event.tags.some((t) => activeTags.includes(t))) {
        return false;
      }
      // Type filter
      if (activeTypes.length > 0 && !activeTypes.includes(event.type)) {
        return false;
      }
      // Date range filter
      if (startDate && event.date < startDate) return false;
      if (endDate && event.date > endDate) return false;
      // Search text
      if (searchText) {
        const lower = searchText.toLowerCase();
        if (
          !event.title.toLowerCase().includes(lower) &&
          !event.description.toLowerCase().includes(lower)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [timeline.events, timeline.filter]);

  // ── Export / Import ──

  const exportTimeline = useCallback((): string => {
    return JSON.stringify({
      events: timeline.events,
      tags: timeline.tags,
    }, null, 2);
  }, [timeline.events, timeline.tags]);

  const importTimeline = useCallback((json: string) => {
    try {
      const data = JSON.parse(json);
      if (data.events && Array.isArray(data.events)) {
        pushHistory();
        setTimeline((prev) => ({
          ...prev,
          events: sortEventsByDate(data.events),
          tags: data.tags ?? prev.tags,
        }));
      }
    } catch {
      // Invalid JSON — ignore
    }
  }, [pushHistory]);

  return {
    timeline,
    // Event operations
    addEvent,
    addEvents,
    updateEvent,
    deleteEvents,
    // Tag operations
    addTag,
    updateTag,
    deleteTag,
    // Selection
    selectEvents,
    clearSelection,
    // Viewport
    setZoom,
    setCenterDate,
    setScrollY,
    // Filter
    setFilter,
    toggleTagFilter,
    toggleTypeFilter,
    getFilteredEvents,
    // History
    undo,
    redo,
    pushHistory,
    // Export/Import
    exportTimeline,
    importTimeline,
  };
}
