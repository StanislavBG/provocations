// ── Timeline Data Model ──────────────────────────────────────────────

export type TimelineEventType = "milestone" | "phase" | "decision" | "delivery" | "event";

export type TimelineTagCategory = "person" | "place" | "theme";

export type TimelineZoomLevel = "decades" | "years" | "months" | "days";

// ── Tag ──

export interface TimelineTag {
  id: string;
  label: string;
  category: TimelineTagCategory;
  color: string;
}

// ── Event ──

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string;
  /** ISO date string for the event start (e.g. "2015-06-15" or "1990" for approximate) */
  date: string;
  /** Optional ISO date string for event end (phases/durations) */
  endDate?: string;
  /** Human-readable date label for approximate dates (e.g. "Early 1990s") */
  dateLabel?: string;
  tags: string[]; // tag IDs
  /** Confidence: how certain is the date? */
  dateConfidence: "exact" | "approximate" | "estimated";
  /** Source of this event (interview, note, manual) */
  source: "interview" | "note" | "manual";
  /** Custom color override */
  color?: string;
}

// ── Viewport ──

export interface TimelineViewport {
  /** Center date as ISO string */
  centerDate: string;
  /** Zoom level */
  zoom: TimelineZoomLevel;
  /** Vertical scroll offset in pixels */
  scrollY: number;
}

// ── Filter State ──

export interface TimelineFilter {
  /** Active tag IDs to filter by (empty = show all) */
  activeTags: string[];
  /** Event types to show (empty = show all) */
  activeTypes: TimelineEventType[];
  /** Date range filter */
  startDate?: string;
  endDate?: string;
  /** Search text */
  searchText: string;
}

// ── Full Timeline State ──

export interface Timeline {
  events: TimelineEvent[];
  tags: TimelineTag[];
  viewport: TimelineViewport;
  filter: TimelineFilter;
  selectedEventIds: string[];
}

export const EMPTY_TIMELINE: Timeline = {
  events: [],
  tags: [],
  viewport: {
    centerDate: new Date().toISOString().slice(0, 10),
    zoom: "years",
    scrollY: 0,
  },
  filter: {
    activeTags: [],
    activeTypes: [],
    searchText: "",
  },
  selectedEventIds: [],
};

// ── Event type display config ──

export const EVENT_TYPE_CONFIG: Record<TimelineEventType, { label: string; color: string; icon: string }> = {
  milestone: { label: "Milestone", color: "#f59e0b", icon: "Star" },
  phase: { label: "Phase", color: "#3b82f6", icon: "ArrowRight" },
  decision: { label: "Decision", color: "#8b5cf6", icon: "GitBranch" },
  delivery: { label: "Delivery", color: "#22c55e", icon: "Package" },
  event: { label: "Event", color: "#64748b", icon: "Circle" },
};

// ── Tag category display config ──

export const TAG_CATEGORY_CONFIG: Record<TimelineTagCategory, { label: string; defaultColor: string }> = {
  person: { label: "Person", defaultColor: "#ec4899" },
  place: { label: "Place", defaultColor: "#06b6d4" },
  theme: { label: "Theme", defaultColor: "#f97316" },
};

// ── Zoom level config ──

export const ZOOM_LEVELS: TimelineZoomLevel[] = ["decades", "years", "months", "days"];

export const ZOOM_CONFIG: Record<TimelineZoomLevel, { label: string; unitMs: number }> = {
  decades: { label: "Decades", unitMs: 365.25 * 24 * 60 * 60 * 1000 * 10 },
  years: { label: "Years", unitMs: 365.25 * 24 * 60 * 60 * 1000 },
  months: { label: "Months", unitMs: 30.44 * 24 * 60 * 60 * 1000 },
  days: { label: "Days", unitMs: 24 * 60 * 60 * 1000 },
};

// ── Helper: parse timeline date string to Date ──

export function parseTimelineDate(dateStr: string): Date {
  // Handle year-only: "1990" → Jan 1 1990
  if (/^\d{4}$/.test(dateStr)) {
    return new Date(parseInt(dateStr), 0, 1);
  }
  // Handle year-month: "1990-06" → Jun 1 1990
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [y, m] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }
  return new Date(dateStr);
}

// ── Helper: sort events chronologically ──

export function sortEventsByDate(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    const dateA = parseTimelineDate(a.date);
    const dateB = parseTimelineDate(b.date);
    return dateA.getTime() - dateB.getTime();
  });
}
