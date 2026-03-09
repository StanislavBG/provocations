/**
 * PromptEditorAutocomplete — Floating dropdown for @-triggered context block selection.
 *
 * Shows filtered list of available context blocks. Supports keyboard navigation
 * (arrow keys + enter) and mouse selection.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContextBlock } from "./PromptEditor";

interface PromptEditorAutocompleteProps {
  blocks: ContextBlock[];
  query: string;
  position: { top: number; left: number };
  onSelect: (label: string) => void;
  onClose: () => void;
}

export function PromptEditorAutocomplete({
  blocks,
  query,
  position,
  onSelect,
  onClose,
}: PromptEditorAutocompleteProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter blocks by query
  const filtered = blocks.filter((b) =>
    b.label.toLowerCase().includes(query.toLowerCase()),
  );

  // Reset active index when filtered results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Global keyboard handler for arrow navigation + selection
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filtered.length > 0) {
          onSelect(filtered[activeIndex]?.label || filtered[0].label);
        } else {
          onClose();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [filtered, activeIndex, onSelect, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  if (filtered.length === 0) {
    return (
      <div
        className="absolute z-50 rounded-md border border-border/60 bg-popover shadow-lg p-2"
        style={{ top: position.top, left: position.left, minWidth: 200 }}
      >
        <p className="text-xs text-muted-foreground/60 px-2 py-1">No matching blocks</p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="absolute z-50 rounded-md border border-border/60 bg-popover shadow-lg py-1 max-h-48 overflow-y-auto"
      style={{ top: position.top, left: position.left, minWidth: 240, maxWidth: 360 }}
    >
      {filtered.map((block, i) => (
        <button
          key={block.label}
          className={cn(
            "w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors",
            i === activeIndex
              ? "bg-amber-500/15 text-foreground"
              : "hover:bg-muted/50 text-muted-foreground",
          )}
          onMouseEnter={() => setActiveIndex(i)}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent blur
            onSelect(block.label);
          }}
        >
          <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{block.label}</div>
            <div className="text-[10px] text-muted-foreground/60 truncate">
              {block.content.slice(0, 100)}{block.content.length > 100 ? "…" : ""}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
