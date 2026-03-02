import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Wand2,
  ArrowDown,
  X,
  Trash2,
  Lightbulb,
  Search,
  HelpCircle,
  CheckCircle,
  StickyNote,
  Mic,
} from "lucide-react";
import type { ContextItem } from "@shared/schema";

type AnnotationType = "finding" | "decision" | "question" | "note";

const ANNOTATION_CONFIG: Record<AnnotationType, { label: string; color: string; icon: typeof Lightbulb }> = {
  finding: { label: "Finding", color: "text-blue-500 bg-blue-500/10 border-blue-500/20", icon: Search },
  decision: { label: "Decision", color: "text-green-500 bg-green-500/10 border-green-500/20", icon: CheckCircle },
  question: { label: "Question", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", icon: HelpCircle },
  note: { label: "Note", color: "text-muted-foreground bg-muted/50 border-border/50", icon: StickyNote },
};

interface FtuxNotesPanelProps {
  capturedContext: ContextItem[];
  onAddNote: (text: string, annotation: string) => void;
  onRemoveNote: (id: string) => void;
  onApplyNote: (content: string) => void;
  onInsertNote: (content: string) => void;
  onEvolveAll: () => void;
  onClearAll: () => void;
  isMerging: boolean;
}

export function FtuxNotesPanel({
  capturedContext,
  onAddNote,
  onRemoveNote,
  onApplyNote,
  onInsertNote,
  onEvolveAll,
  onClearAll,
  isMerging,
}: FtuxNotesPanelProps) {
  const [noteText, setNoteText] = useState("");
  const [annotationType, setAnnotationType] = useState<AnnotationType>("note");
  const [autoEvolve, setAutoEvolve] = useState(false);
  const autoEvolveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [autoEvolveProgress, setAutoEvolveProgress] = useState<Map<string, number>>(new Map());

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      autoEvolveTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const handleAddNote = useCallback(() => {
    const text = noteText.trim();
    if (!text) return;

    const annotation = ANNOTATION_CONFIG[annotationType].label;
    onAddNote(text, annotation);
    setNoteText("");

    // Auto-evolve: schedule apply after 5 seconds
    if (autoEvolve) {
      // We'll use the content directly since we don't have the ID yet
      // The timer starts a countdown
      const timerId = setTimeout(() => {
        onApplyNote(text);
      }, 5000);

      // Track progress for UI feedback
      const progressKey = `auto-${Date.now()}`;
      autoEvolveTimers.current.set(progressKey, timerId);
      setAutoEvolveProgress((prev) => new Map(prev).set(progressKey, 100));

      // Animate the countdown
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / 5000) * 100);
        setAutoEvolveProgress((prev) => new Map(prev).set(progressKey, remaining));
        if (remaining <= 0) {
          clearInterval(interval);
          setAutoEvolveProgress((prev) => {
            const next = new Map(prev);
            next.delete(progressKey);
            return next;
          });
        }
      }, 100);
    }
  }, [noteText, annotationType, autoEvolve, onAddNote, onApplyNote]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  };

  const formatTimestamp = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-serif font-bold">Notes</h2>
          {capturedContext.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {capturedContext.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Switch
              id="auto-evolve"
              checked={autoEvolve}
              onCheckedChange={setAutoEvolve}
              className="scale-75"
            />
            <Label htmlFor="auto-evolve" className="text-[10px] text-muted-foreground cursor-pointer">
              Auto-evolve
            </Label>
          </div>
          {capturedContext.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={onEvolveAll}
                disabled={isMerging}
              >
                <Wand2 className="w-3 h-3 mr-1" />
                Apply All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                onClick={onClearAll}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Input area */}
        <div className="w-2/5 border-r p-3 flex flex-col gap-3 shrink-0">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a note, finding, or decision..."
            className="flex-1 min-h-[80px] resize-none rounded-lg border bg-background/50 p-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />

          {/* Annotation type selector */}
          <div className="flex items-center gap-1">
            {(Object.keys(ANNOTATION_CONFIG) as AnnotationType[]).map((type) => {
              const config = ANNOTATION_CONFIG[type];
              const Icon = config.icon;
              return (
                <button
                  key={type}
                  onClick={() => setAnnotationType(type)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-colors",
                    annotationType === type
                      ? config.color
                      : "text-muted-foreground bg-transparent border-transparent hover:bg-muted/50",
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {config.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleAddNote}
              disabled={!noteText.trim()}
              size="sm"
              className="flex-1 h-8 text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Note
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              title="Voice input"
            >
              <Mic className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Right: Note cards list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {capturedContext.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <StickyNote className="w-8 h-8 text-muted-foreground/20 mx-auto" />
                <p className="text-xs text-muted-foreground/60">
                  No notes yet. Add your first note to get started.
                </p>
              </div>
            </div>
          ) : (
            capturedContext.map((item) => (
              <NoteCard
                key={item.id}
                item={item}
                onApply={() => onApplyNote(item.content)}
                onInsert={() => onInsertNote(item.content)}
                onDismiss={() => onRemoveNote(item.id)}
                isMerging={isMerging}
                formatTimestamp={formatTimestamp}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface NoteCardProps {
  item: ContextItem;
  onApply: () => void;
  onInsert: () => void;
  onDismiss: () => void;
  isMerging: boolean;
  formatTimestamp: (ts: number) => string;
}

function NoteCard({ item, onApply, onInsert, onDismiss, isMerging, formatTimestamp }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.content.length > 200;

  // Determine badge color from annotation
  const annotationLower = (item.annotation || "note").toLowerCase();
  const badgeType: AnnotationType =
    annotationLower.includes("finding") ? "finding" :
    annotationLower.includes("decision") ? "decision" :
    annotationLower.includes("question") ? "question" :
    "note";
  const config = ANNOTATION_CONFIG[badgeType];
  const BadgeIcon = config.icon;

  return (
    <div className="rounded-xl border bg-card/60 backdrop-blur-sm p-3 space-y-2 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn("text-[10px] h-4 px-1.5 gap-0.5", config.color)}
          >
            <BadgeIcon className="w-2.5 h-2.5" />
            {item.annotation || "Note"}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {formatTimestamp(item.createdAt)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        className={cn(
          "text-xs leading-relaxed text-foreground/80",
          !expanded && isLong && "line-clamp-3",
        )}
      >
        {item.content}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-primary hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={onApply}
          disabled={isMerging}
          title="Apply this note to evolve the document"
        >
          <Wand2 className="w-3 h-3 mr-1" />
          Apply
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={onInsert}
          title="Insert as-is into the document"
        >
          <ArrowDown className="w-3 h-3 mr-1" />
          Insert
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onDismiss}
          title="Remove note"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
