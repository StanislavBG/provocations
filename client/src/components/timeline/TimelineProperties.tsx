import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Calendar, Tag, User, MapPin, Trash2 } from "lucide-react";
import {
  type TimelineEvent,
  type TimelineTag,
  type TimelineEventType,
  type TimelineTagCategory,
  EVENT_TYPE_CONFIG,
} from "./types";

interface TimelinePropertiesProps {
  event: TimelineEvent | null;
  tags: TimelineTag[];
  onUpdateEvent: (eventId: string, updates: Partial<Omit<TimelineEvent, "id">>) => void;
  onDeleteEvent: (eventId: string) => void;
  onClose: () => void;
}

function TagCategoryIcon({ category }: { category: TimelineTagCategory }) {
  switch (category) {
    case "person":
      return <User className="h-3 w-3" />;
    case "place":
      return <MapPin className="h-3 w-3" />;
    case "theme":
      return <Tag className="h-3 w-3" />;
  }
}

export function TimelineProperties({
  event,
  tags,
  onUpdateEvent,
  onDeleteEvent,
  onClose,
}: TimelinePropertiesProps) {
  const eventTags = useMemo(() => {
    if (!event) return [];
    return tags.filter((t) => event.tags.includes(t.id));
  }, [event, tags]);

  const availableTags = useMemo(() => {
    if (!event) return tags;
    return tags.filter((t) => !event.tags.includes(t.id));
  }, [event, tags]);

  if (!event) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4">
        <div className="text-center space-y-1">
          <Calendar className="h-8 w-8 mx-auto opacity-30" />
          <p className="text-xs">Select an event to view properties</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Event Properties
          </h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Separator />

        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs">Title</Label>
          <Input
            value={event.title}
            onChange={(e) => onUpdateEvent(event.id, { title: e.target.value })}
            className="h-8 text-xs"
          />
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select
            value={event.type}
            onValueChange={(v) => onUpdateEvent(event.id, { type: v as TimelineEventType })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(EVENT_TYPE_CONFIG) as [TimelineEventType, { label: string; color: string }][]).map(
                ([type, config]) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                      {config.label}
                    </div>
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label className="text-xs">Date</Label>
          <Input
            value={event.date}
            onChange={(e) => onUpdateEvent(event.id, { date: e.target.value })}
            className="h-8 text-xs"
            placeholder="YYYY-MM-DD or YYYY"
          />
        </div>

        {/* End Date (optional) */}
        <div className="space-y-1.5">
          <Label className="text-xs">End Date (optional)</Label>
          <Input
            value={event.endDate ?? ""}
            onChange={(e) =>
              onUpdateEvent(event.id, {
                endDate: e.target.value || undefined,
              })
            }
            className="h-8 text-xs"
            placeholder="YYYY-MM-DD (for phases/durations)"
          />
        </div>

        {/* Date Label */}
        <div className="space-y-1.5">
          <Label className="text-xs">Date Label</Label>
          <Input
            value={event.dateLabel ?? ""}
            onChange={(e) =>
              onUpdateEvent(event.id, { dateLabel: e.target.value || undefined })
            }
            className="h-8 text-xs"
            placeholder='e.g. "Early 1990s", "Summer 2015"'
          />
        </div>

        {/* Date Confidence */}
        <div className="space-y-1.5">
          <Label className="text-xs">Date Confidence</Label>
          <Select
            value={event.dateConfidence}
            onValueChange={(v) =>
              onUpdateEvent(event.id, {
                dateConfidence: v as "exact" | "approximate" | "estimated",
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exact" className="text-xs">Exact</SelectItem>
              <SelectItem value="approximate" className="text-xs">Approximate</SelectItem>
              <SelectItem value="estimated" className="text-xs">Estimated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea
            value={event.description}
            onChange={(e) => onUpdateEvent(event.id, { description: e.target.value })}
            className="text-xs min-h-[80px] resize-y"
          />
        </div>

        <Separator />

        {/* Tags */}
        <div className="space-y-2">
          <Label className="text-xs">Tags</Label>

          {/* Current tags */}
          {eventTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {eventTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="text-[10px] px-1.5 gap-1 cursor-pointer"
                  style={{ borderColor: tag.color, color: tag.color }}
                  onClick={() =>
                    onUpdateEvent(event.id, {
                      tags: event.tags.filter((t) => t !== tag.id),
                    })
                  }
                >
                  <TagCategoryIcon category={tag.category} />
                  {tag.label}
                  <X className="h-2.5 w-2.5" />
                </Badge>
              ))}
            </div>
          )}

          {/* Available tags to add */}
          {availableTags.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Click to add:</p>
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="text-[10px] px-1.5 gap-1 cursor-pointer opacity-60 hover:opacity-100"
                    style={{ borderColor: tag.color, color: tag.color }}
                    onClick={() =>
                      onUpdateEvent(event.id, {
                        tags: [...event.tags, tag.id],
                      })
                    }
                  >
                    <TagCategoryIcon category={tag.category} />
                    {tag.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Source info */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Source</Label>
          <p className="text-xs text-muted-foreground capitalize">{event.source}</p>
        </div>

        {/* Delete */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive hover:text-destructive text-xs gap-1.5"
          onClick={() => onDeleteEvent(event.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Event
        </Button>
      </div>
    </ScrollArea>
  );
}
