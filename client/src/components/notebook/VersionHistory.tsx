import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DiffViewer } from "./DiffViewer";
import { cn } from "@/lib/utils";
import { X, RotateCcw, Clock, FileText, ArrowRight } from "lucide-react";
import type { DocumentVersion } from "@shared/schema";

interface VersionHistoryProps {
  versions: DocumentVersion[];
  currentContent: string;
  onRestore: (content: string) => void;
  onClose: () => void;
}

export function VersionHistory({
  versions,
  currentContent,
  onRestore,
  onClose,
}: VersionHistoryProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  // For comparing two arbitrary versions
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);

  const isCompareMode = compareFrom !== null && compareTo !== null;

  // Get diff content based on selection
  const diffContent = (() => {
    if (isCompareMode) {
      return {
        oldText: versions[compareFrom].text,
        newText: versions[compareTo].text,
        oldLabel: `Version ${compareFrom + 1}`,
        newLabel: `Version ${compareTo + 1}`,
      };
    }
    if (selectedIdx !== null) {
      return {
        oldText: versions[selectedIdx].text,
        newText: currentContent,
        oldLabel: `Version ${selectedIdx + 1}`,
        newLabel: "Current",
      };
    }
    return null;
  })();

  const handleVersionClick = (idx: number) => {
    // If in compare mode, set the second point
    if (compareFrom !== null && compareTo === null) {
      setCompareTo(idx);
      return;
    }
    // Normal: select to diff against current
    setCompareFrom(null);
    setCompareTo(null);
    setSelectedIdx(idx === selectedIdx ? null : idx);
  };

  const handleStartCompare = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIdx(null);
    setCompareFrom(idx);
    setCompareTo(null);
  };

  const handleClearCompare = () => {
    setCompareFrom(null);
    setCompareTo(null);
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  };

  if (versions.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Version History</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          <div className="text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No versions yet</p>
            <p className="text-xs mt-1">Versions are created when the document evolves</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Version History</span>
          <Badge variant="secondary" className="text-xs">{versions.length}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Compare mode indicator */}
      {compareFrom !== null && compareTo === null && (
        <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 text-xs flex items-center gap-2">
          <ArrowRight className="w-3 h-3" />
          <span>Select a second version to compare</span>
          <Button variant="ghost" size="sm" className="h-5 text-xs ml-auto" onClick={handleClearCompare}>
            Cancel
          </Button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Version list */}
        <ScrollArea className="w-56 border-r border-border/50 shrink-0">
          <div className="p-2 space-y-1">
            {[...versions].reverse().map((version, reverseIdx) => {
              const idx = versions.length - 1 - reverseIdx;
              const isSelected = selectedIdx === idx;
              const isCompareTarget = compareFrom === idx || compareTo === idx;

              return (
                <div
                  key={version.id}
                  className={cn(
                    "p-2 rounded-md cursor-pointer transition-colors group",
                    isSelected && "bg-primary/10 border border-primary/30",
                    isCompareTarget && "bg-blue-500/10 border border-blue-500/30",
                    !isSelected && !isCompareTarget && "hover:bg-muted/50",
                  )}
                  onClick={() => handleVersionClick(idx)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">
                      Version {idx + 1}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(version.timestamp)}
                    </span>
                  </div>
                  {version.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                      {version.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px] px-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore(version.text);
                      }}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px] px-1.5"
                      onClick={(e) => handleStartCompare(idx, e)}
                    >
                      Compare...
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Diff area */}
        <div className="flex-1 min-w-0">
          {diffContent ? (
            <DiffViewer {...diffContent} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <div className="text-center">
                <p>Click a version to see changes</p>
                <p className="text-xs mt-1">or use "Compare..." to diff two versions</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
