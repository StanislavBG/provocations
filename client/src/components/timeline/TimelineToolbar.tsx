import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Plus,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Search,
  Filter,
  Tag,
  Download,
  Upload,
  Trash2,
  User,
  MapPin,
} from "lucide-react";
import {
  type TimelineTag,
  type TimelineTagCategory,
  type TimelineEventType,
  type TimelineZoomLevel,
  type TimelineFilter,
  EVENT_TYPE_CONFIG,
  TAG_CATEGORY_CONFIG,
  ZOOM_LEVELS,
  ZOOM_CONFIG,
} from "./types";

interface TimelineToolbarProps {
  tags: TimelineTag[];
  filter: TimelineFilter;
  zoom: TimelineZoomLevel;
  selectedCount: number;
  eventCount: number;
  onAddEvent: () => void;
  onAddTag: (label: string, category: TimelineTagCategory) => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomChange: (zoom: TimelineZoomLevel) => void;
  onToggleTagFilter: (tagId: string) => void;
  onToggleTypeFilter: (type: TimelineEventType) => void;
  onSearchChange: (text: string) => void;
  onExport: () => void;
  onImport: (json: string) => void;
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

export function TimelineToolbar({
  tags,
  filter,
  zoom,
  selectedCount,
  eventCount,
  onAddEvent,
  onAddTag,
  onDeleteSelected,
  onUndo,
  onRedo,
  onZoomChange,
  onToggleTagFilter,
  onToggleTypeFilter,
  onSearchChange,
  onExport,
  onImport,
}: TimelineToolbarProps) {
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagCategory, setNewTagCategory] = useState<TimelineTagCategory>("theme");
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

  const handleAddTag = () => {
    if (!newTagLabel.trim()) return;
    onAddTag(newTagLabel.trim(), newTagCategory);
    setNewTagLabel("");
    setTagPopoverOpen(false);
  };

  const handleImportClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      onImport(text);
    };
    input.click();
  };

  const currentZoomIdx = ZOOM_LEVELS.indexOf(zoom);
  const canZoomIn = currentZoomIdx < ZOOM_LEVELS.length - 1;
  const canZoomOut = currentZoomIdx > 0;

  const activeFilterCount =
    filter.activeTags.length +
    filter.activeTypes.length +
    (filter.searchText ? 1 : 0);

  return (
    <div className="flex flex-col gap-2 p-3 border-b bg-card/50">
      {/* Top row: actions */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Add event */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={onAddEvent} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs">Event</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add a new timeline event</TooltipContent>
        </Tooltip>

        {/* Add tag */}
        <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              <span className="text-xs">Tag</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-2">
              <p className="text-xs font-medium">New Tag</p>
              <Input
                value={newTagLabel}
                onChange={(e) => setNewTagLabel(e.target.value)}
                placeholder="Tag name..."
                className="h-7 text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
              />
              <Select
                value={newTagCategory}
                onValueChange={(v) => setNewTagCategory(v as TimelineTagCategory)}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TAG_CATEGORY_CONFIG) as [TimelineTagCategory, { label: string }][]).map(
                    ([key, { label }]) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <Button size="sm" className="w-full h-7 text-xs" onClick={handleAddTag}>
                Add Tag
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Undo / Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onUndo}>
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRedo}>
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Zoom controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => canZoomOut && onZoomChange(ZOOM_LEVELS[currentZoomIdx - 1])}
              disabled={!canZoomOut}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>
        <span className="text-xs text-muted-foreground min-w-[4.5rem] text-center">
          {ZOOM_CONFIG[zoom].label}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => canZoomIn && onZoomChange(ZOOM_LEVELS[currentZoomIdx + 1])}
              disabled={!canZoomIn}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Filter */}
        <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={activeFilterCount > 0 ? "default" : "ghost"}
              size="sm"
              className="gap-1.5 h-7"
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="text-xs">Filter</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <ScrollArea className="max-h-64">
              <div className="space-y-3">
                {/* Event types */}
                <div>
                  <p className="text-xs font-medium mb-1.5">Event Types</p>
                  <div className="flex flex-wrap gap-1">
                    {(Object.entries(EVENT_TYPE_CONFIG) as [TimelineEventType, { label: string; color: string }][]).map(
                      ([type, config]) => {
                        const isActive = filter.activeTypes.includes(type);
                        return (
                          <Badge
                            key={type}
                            variant={isActive ? "default" : "outline"}
                            className="cursor-pointer text-[10px] px-1.5"
                            style={isActive ? { backgroundColor: config.color } : undefined}
                            onClick={() => onToggleTypeFilter(type)}
                          >
                            {config.label}
                          </Badge>
                        );
                      },
                    )}
                  </div>
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1.5">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => {
                        const isActive = filter.activeTags.includes(tag.id);
                        return (
                          <Badge
                            key={tag.id}
                            variant={isActive ? "default" : "outline"}
                            className="cursor-pointer text-[10px] px-1.5 gap-1"
                            style={
                              isActive
                                ? { backgroundColor: tag.color }
                                : { borderColor: tag.color, color: tag.color }
                            }
                            onClick={() => onToggleTagFilter(tag.id)}
                          >
                            <TagCategoryIcon category={tag.category} />
                            {tag.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={filter.searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search events..."
            className="h-7 text-xs pl-7 w-40"
          />
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Delete selected */}
        {selectedCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={onDeleteSelected}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete {selectedCount} selected</TooltipContent>
          </Tooltip>
        )}

        {/* Export / Import */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onExport}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export timeline JSON</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleImportClick}>
              <Upload className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Import timeline JSON</TooltipContent>
        </Tooltip>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground px-1">
        <span>{eventCount} event{eventCount !== 1 ? "s" : ""}</span>
        {tags.length > 0 && <span>{tags.length} tag{tags.length !== 1 ? "s" : ""}</span>}
        {selectedCount > 0 && (
          <span className="text-primary font-medium">
            {selectedCount} selected
          </span>
        )}
        {activeFilterCount > 0 && (
          <span className="text-amber-500">
            {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
          </span>
        )}
      </div>
    </div>
  );
}
