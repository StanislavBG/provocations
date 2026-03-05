import { useState, useMemo } from "react";
import { diffWords, diffLines, type Change } from "diff";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Columns2, AlignJustify } from "lucide-react";

interface DiffViewerProps {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
}

type DiffMode = "inline" | "side-by-side";

export function DiffViewer({
  oldText,
  newText,
  oldLabel = "Previous",
  newLabel = "Current",
}: DiffViewerProps) {
  const [mode, setMode] = useState<DiffMode>("inline");
  const [granularity, setGranularity] = useState<"words" | "lines">("words");

  const changes = useMemo(() => {
    return granularity === "words"
      ? diffWords(oldText, newText)
      : diffLines(oldText, newText);
  }, [oldText, newText, granularity]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const change of changes) {
      const count = change.value.split(/\s+/).filter(Boolean).length;
      if (change.added) added += count;
      else if (change.removed) removed += count;
    }
    return { added, removed };
  }, [changes]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400">
            +{stats.added} words
          </Badge>
          <Badge variant="outline" className="text-xs text-red-600 dark:text-red-400">
            -{stats.removed} words
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={granularity === "words" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setGranularity("words")}
          >
            Words
          </Button>
          <Button
            variant={granularity === "lines" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setGranularity("lines")}
          >
            Lines
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant={mode === "inline" ? "secondary" : "ghost"}
            size="icon"
            className="h-6 w-6"
            onClick={() => setMode("inline")}
            title="Inline diff"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant={mode === "side-by-side" ? "secondary" : "ghost"}
            size="icon"
            className="h-6 w-6"
            onClick={() => setMode("side-by-side")}
            title="Side by side"
          >
            <Columns2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Diff content */}
      <ScrollArea className="flex-1 min-h-0">
        {mode === "inline" ? (
          <InlineDiff changes={changes} />
        ) : (
          <SideBySideDiff changes={changes} oldLabel={oldLabel} newLabel={newLabel} />
        )}
      </ScrollArea>
    </div>
  );
}

function InlineDiff({ changes }: { changes: Change[] }) {
  return (
    <div className="p-4 font-['Source_Serif_4'] text-sm leading-relaxed whitespace-pre-wrap">
      {changes.map((change, i) => (
        <span
          key={i}
          className={cn(
            change.added && "bg-green-500/20 text-green-800 dark:text-green-300",
            change.removed && "bg-red-500/20 text-red-800 dark:text-red-300 line-through",
            !change.added && !change.removed && "text-foreground/80",
          )}
        >
          {change.value}
        </span>
      ))}
    </div>
  );
}

function SideBySideDiff({
  changes,
  oldLabel,
  newLabel,
}: {
  changes: Change[];
  oldLabel: string;
  newLabel: string;
}) {
  // Build left (old) and right (new) content
  const { leftParts, rightParts } = useMemo(() => {
    const left: Array<{ text: string; type: "same" | "removed" }> = [];
    const right: Array<{ text: string; type: "same" | "added" }> = [];

    for (const change of changes) {
      if (change.added) {
        right.push({ text: change.value, type: "added" });
      } else if (change.removed) {
        left.push({ text: change.value, type: "removed" });
      } else {
        left.push({ text: change.value, type: "same" });
        right.push({ text: change.value, type: "same" });
      }
    }
    return { leftParts: left, rightParts: right };
  }, [changes]);

  return (
    <div className="grid grid-cols-2 divide-x divide-border min-h-full">
      <div className="flex flex-col">
        <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-b border-border/50">
          {oldLabel}
        </div>
        <div className="p-3 font-['Source_Serif_4'] text-sm leading-relaxed whitespace-pre-wrap">
          {leftParts.map((part, i) => (
            <span
              key={i}
              className={cn(
                part.type === "removed" && "bg-red-500/20 text-red-800 dark:text-red-300",
                part.type === "same" && "text-foreground/80",
              )}
            >
              {part.text}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col">
        <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-b border-border/50">
          {newLabel}
        </div>
        <div className="p-3 font-['Source_Serif_4'] text-sm leading-relaxed whitespace-pre-wrap">
          {rightParts.map((part, i) => (
            <span
              key={i}
              className={cn(
                part.type === "added" && "bg-green-500/20 text-green-800 dark:text-green-300",
                part.type === "same" && "text-foreground/80",
              )}
            >
              {part.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
