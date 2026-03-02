import { useCallback, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type TimelineEvent,
  type TimelineTag,
  type TimelineZoomLevel,
  EVENT_TYPE_CONFIG,
  parseTimelineDate,
  sortEventsByDate,
  detectDateGranularity,
} from "./types";
import {
  Star,
  ArrowRight,
  GitBranch,
  Package,
  Circle,
  Calendar,
  MapPin,
  User,
  Tag,
} from "lucide-react";

interface TimelineCanvasProps {
  events: TimelineEvent[];
  tags: TimelineTag[];
  zoom: TimelineZoomLevel;
  selectedEventIds: string[];
  onSelectEvent: (eventId: string, additive?: boolean) => void;
  onClearSelection: () => void;
}

const EVENT_ICONS: Record<string, typeof Star> = {
  Star,
  ArrowRight,
  GitBranch,
  Package,
  Circle,
};

/** Group events by time period based on zoom level */
function groupEventsByPeriod(
  events: TimelineEvent[],
  zoom: TimelineZoomLevel,
): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();

  for (const event of events) {
    const date = parseTimelineDate(event.date);
    let key: string;

    switch (zoom) {
      case "decades":
        key = `${Math.floor(date.getFullYear() / 10) * 10}s`;
        break;
      case "years":
        key = `${date.getFullYear()}`;
        break;
      case "months":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        break;
      case "days":
        key = date.toISOString().slice(0, 10);
        break;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(event);
  }

  return groups;
}

/** Format a period key for display */
function formatPeriodLabel(key: string, zoom: TimelineZoomLevel): string {
  switch (zoom) {
    case "decades":
      return key;
    case "years":
      return key;
    case "months": {
      const [y, m] = key.split("-");
      const date = new Date(parseInt(y), parseInt(m) - 1);
      return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    }
    case "days": {
      const date = new Date(key);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
}

/** Format event date showing only detail beyond what the group header already shows */
function formatEventDateInContext(dateStr: string, zoom: TimelineZoomLevel): string {
  const granularity = detectDateGranularity(dateStr);
  const date = parseTimelineDate(dateStr);

  // If the event only has year-level data, the group header already covers it
  if (granularity === "year") {
    if (zoom === "decades") return `${date.getFullYear()}`;
    return ""; // year group already shows this
  }

  if (granularity === "month") {
    if (zoom === "decades" || zoom === "years") {
      return date.toLocaleDateString("en-US", { month: "short" });
    }
    return ""; // month group already shows this
  }

  // day or time granularity
  switch (zoom) {
    case "decades":
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    case "years":
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    case "months":
      if (granularity === "time") {
        return date.toLocaleDateString("en-US", { day: "numeric", hour: "numeric", minute: "2-digit" });
      }
      return date.toLocaleDateString("en-US", { day: "numeric" });
    case "days":
      if (granularity === "time") {
        return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      }
      return ""; // day group already shows this
  }
}

function EventIcon({ iconName }: { iconName: string }) {
  const Icon = EVENT_ICONS[iconName] ?? Circle;
  return <Icon className="h-3.5 w-3.5" />;
}

function TagBadge({ tag }: { tag: TimelineTag }) {
  const CategoryIcon = tag.category === "person" ? User : tag.category === "place" ? MapPin : Tag;
  return (
    <Badge
      variant="outline"
      className="text-[10px] px-1.5 py-0 gap-1 font-normal"
      style={{ borderColor: tag.color, color: tag.color }}
    >
      <CategoryIcon className="h-2.5 w-2.5" />
      {tag.label}
    </Badge>
  );
}

export function TimelineCanvas({
  events,
  tags,
  zoom,
  selectedEventIds,
  onSelectEvent,
  onClearSelection,
}: TimelineCanvasProps) {
  const tagMap = useMemo(() => {
    const map = new Map<string, TimelineTag>();
    for (const tag of tags) map.set(tag.id, tag);
    return map;
  }, [tags]);

  const sortedEvents = useMemo(() => sortEventsByDate(events), [events]);

  const grouped = useMemo(
    () => groupEventsByPeriod(sortedEvents, zoom),
    [sortedEvents, zoom],
  );

  const handleBackgroundClick = useCallback(() => {
    onClearSelection();
  }, [onClearSelection]);

  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2 max-w-sm px-4">
          <Calendar className="h-12 w-12 mx-auto opacity-30" />
          <p className="text-sm font-medium">No events yet</p>
          <p className="text-xs">
            Add events manually using the toolbar, or capture them from notes and interviews.
            Events will appear here in chronological order.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" onClick={handleBackgroundClick}>
      <div className="relative px-6 py-8 min-h-full">
        {/* Vertical spine line */}
        <div className="absolute left-[2.75rem] top-0 bottom-0 w-px bg-border" />

        {/* Period groups */}
        {Array.from(grouped.entries()).map(([period, periodEvents]) => (
          <div key={period} className="mb-8 last:mb-0">
            {/* Period header */}
            <div className="flex items-center gap-3 mb-4 relative">
              <div className="w-6 h-6 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center z-10">
                <Calendar className="h-3 w-3 text-primary" />
              </div>
              <span className="text-sm font-semibold text-primary">
                {formatPeriodLabel(period, zoom)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({periodEvents.length} event{periodEvents.length !== 1 ? "s" : ""})
              </span>
            </div>

            {/* Events in this period */}
            <div className="space-y-3 ml-12">
              {periodEvents.map((event, idx) => {
                const config = EVENT_TYPE_CONFIG[event.type];
                const isSelected = selectedEventIds.includes(event.id);
                const eventTags = event.tags
                  .map((tid) => tagMap.get(tid))
                  .filter(Boolean) as TimelineTag[];

                return (
                  <div
                    key={event.id}
                    className={cn(
                      "relative group rounded-lg border p-3 transition-all cursor-pointer",
                      "hover:shadow-md hover:border-primary/30",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-border bg-card",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event.id, e.metaKey || e.ctrlKey);
                    }}
                  >
                    {/* Connector dot */}
                    <div
                      className="absolute -left-[2.1rem] top-4 w-3 h-3 rounded-full border-2 z-10"
                      style={{
                        backgroundColor: event.color ?? config.color,
                        borderColor: event.color ?? config.color,
                      }}
                    />

                    {/* Event header */}
                    <div className="flex items-start gap-2">
                      <div
                        className="mt-0.5 p-1 rounded"
                        style={{ backgroundColor: `${event.color ?? config.color}20` }}
                      >
                        <EventIcon iconName={config.icon} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {event.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 shrink-0"
                            style={{ color: config.color }}
                          >
                            {config.label}
                          </Badge>
                          {event.dateConfidence !== "exact" && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1 py-0 text-muted-foreground shrink-0"
                            >
                              ~{event.dateConfidence}
                            </Badge>
                          )}
                        </div>
                        {(() => {
                          const datePart = formatEventDateInContext(event.date, zoom);
                          const endPart = event.endDate ? formatEventDateInContext(event.endDate, zoom) : "";
                          const labelPart = event.dateLabel || "";
                          const parts = [
                            datePart,
                            endPart ? `— ${endPart}` : "",
                            labelPart,
                          ].filter(Boolean);
                          return parts.length > 0 ? (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {parts.join(" · ")}
                            </p>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    {/* Description */}
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                        {event.description}
                      </p>
                    )}

                    {/* Tags */}
                    {eventTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {eventTags.map((tag) => (
                          <TagBadge key={tag.id} tag={tag} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
