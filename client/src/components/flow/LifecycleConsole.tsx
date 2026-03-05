/**
 * LifecycleConsole — Filterable lifecycle event viewer for the flow canvas.
 *
 * Displays pre-process / process / post-process / activate / deactivate / tick / chain
 * events emitted by the lifecycle engine. Supports filtering by node, node type, phase,
 * and status.
 *
 * Rendered as a bottom panel overlay inside FlowWorkspace.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  useLifecycleLog,
  matchesFilter,
  getPhaseLabel,
  formatLifecycleLog,
  type LifecycleLogEntry,
  type LifecycleFilter,
  type LifecyclePhase,
  type LifecycleStatus,
} from "@/lib/lifecycleLog";
import { FLOW_NODE_REGISTRY } from "./FlowNodeRegistry";
import type { FlowNodeType } from "./useFlowCanvas";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Trash2,
  Copy,
  ChevronDown,
  Filter,
  Pause,
  Play,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Phase badge colors ──

const PHASE_COLORS: Record<LifecyclePhase, string> = {
  "pre-process": "bg-blue-500/20 text-blue-500 border-blue-500/30",
  process: "bg-violet-500/20 text-violet-500 border-violet-500/30",
  "post-process": "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  activate: "bg-green-500/20 text-green-500 border-green-500/30",
  deactivate: "bg-red-500/20 text-red-500 border-red-500/30",
  tick: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  chain: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
};

const STATUS_COLORS: Record<LifecycleStatus, string> = {
  start: "text-blue-400",
  success: "text-emerald-400",
  error: "text-red-400",
  skipped: "text-muted-foreground/60",
};

// ── Component ──

interface LifecycleConsoleProps {
  onClose: () => void;
}

export function LifecycleConsole({ onClose }: LifecycleConsoleProps) {
  const { entries, clear, getNodeTypes, getNodeIds } = useLifecycleLog();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<LifecycleFilter>({});
  const [showFilters, setShowFilters] = useState(false);
  const [pausedSnapshot, setPausedSnapshot] = useState<LifecycleLogEntry[]>([]);

  // Freeze entries when paused
  const displayEntries = paused ? pausedSnapshot : entries;

  // Apply filters
  const filtered = useMemo(() => {
    const hasFilter = filter.nodeId || filter.nodeType || filter.phase || filter.status;
    if (!hasFilter) return displayEntries;
    return displayEntries.filter((e) => matchesFilter(e, filter));
  }, [displayEntries, filter]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll, paused]);

  const handlePauseToggle = useCallback(() => {
    if (paused) {
      setPaused(false);
    } else {
      setPausedSnapshot(entries);
      setPaused(true);
    }
  }, [paused, entries]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(formatLifecycleLog(filtered));
    toast({ title: "Copied", description: `${filtered.length} entries copied to clipboard` });
  }, [filtered, toast]);

  const handleClear = useCallback(() => {
    clear();
    setPausedSnapshot([]);
  }, [clear]);

  // Derive filter options from log data
  const nodeTypes = useMemo(() => getNodeTypes(), [displayEntries.length]);
  const nodeIds = useMemo(() => getNodeIds(), [displayEntries.length]);

  const ALL_PHASES: LifecyclePhase[] = ["pre-process", "process", "post-process", "activate", "deactivate", "tick", "chain"];
  const ALL_STATUSES: LifecycleStatus[] = ["start", "success", "error", "skipped"];

  const activeFilterCount = [filter.nodeId, filter.nodeType, filter.phase, filter.status].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full bg-card/95 backdrop-blur-sm border-t">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Lifecycle
        </span>
        <Badge variant="outline" className="text-[9px] h-4 px-1">
          {filtered.length}{filtered.length !== displayEntries.length ? `/${displayEntries.length}` : ""}
        </Badge>

        <div className="flex-1" />

        {/* Filter toggle */}
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 px-1.5 gap-1 text-[10px]", showFilters && "bg-primary/10 text-primary")}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-3 h-3" />
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full w-3.5 h-3.5 text-[8px] flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {/* Pause */}
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 px-1.5 gap-1 text-[10px]", paused && "bg-amber-500/10 text-amber-500")}
          onClick={handlePauseToggle}
          title={paused ? "Resume live feed" : "Pause feed"}
        >
          {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          {paused ? "Resume" : "Pause"}
        </Button>

        {/* Auto-scroll */}
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 px-1.5 text-[10px]", autoScroll && "text-primary")}
          onClick={() => setAutoScroll(!autoScroll)}
          title={autoScroll ? "Disable auto-scroll" : "Enable auto-scroll"}
        >
          <ArrowDown className="w-3 h-3" />
        </Button>

        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={handleCopy} title="Copy log">
          <Copy className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-destructive" onClick={handleClear} title="Clear log">
          <Trash2 className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Filter bar (collapsible) */}
      {showFilters && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-b bg-muted/20 flex-wrap">
          {/* Node type filter */}
          <FilterSelect
            label="Type"
            value={filter.nodeType || ""}
            options={nodeTypes.map((t) => ({ value: t, label: FLOW_NODE_REGISTRY[t]?.style.badge || t }))}
            onChange={(v) => setFilter((f) => ({ ...f, nodeType: (v || undefined) as FlowNodeType | undefined }))}
          />

          {/* Node filter */}
          <FilterSelect
            label="Node"
            value={filter.nodeId || ""}
            options={nodeIds.map((n) => ({ value: n.id, label: `${n.label} (${n.type})` }))}
            onChange={(v) => setFilter((f) => ({ ...f, nodeId: v || undefined }))}
          />

          {/* Phase filter */}
          <FilterSelect
            label="Phase"
            value={filter.phase || ""}
            options={ALL_PHASES.map((p) => ({ value: p, label: getPhaseLabel(p) }))}
            onChange={(v) => setFilter((f) => ({ ...f, phase: (v || undefined) as LifecyclePhase | undefined }))}
          />

          {/* Status filter */}
          <FilterSelect
            label="Status"
            value={filter.status || ""}
            options={ALL_STATUSES.map((s) => ({ value: s, label: s }))}
            onChange={(v) => setFilter((f) => ({ ...f, status: (v || undefined) as LifecycleStatus | undefined }))}
          />

          {activeFilterCount > 0 && (
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground underline"
              onClick={() => setFilter({})}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Event list */}
      <div ref={scrollRef} className="flex-1 overflow-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground/50 text-xs">
            {entries.length === 0 ? "No lifecycle events yet" : "No events match filter"}
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map((entry) => (
              <EventRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Paused indicator */}
      {paused && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-500/90 text-white text-[9px] font-bold uppercase tracking-wider">
          Paused
        </div>
      )}
    </div>
  );
}

// ── Event Row ──

function EventRow({ entry }: { entry: LifecycleLogEntry }) {
  const time = new Date(entry.timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const nodeStyle = FLOW_NODE_REGISTRY[entry.nodeType]?.style;
  const Icon = FLOW_NODE_REGISTRY[entry.nodeType]?.icon;

  return (
    <div className="flex items-start gap-2 px-3 py-1 text-[10px] hover:bg-muted/20 transition-colors font-mono">
      {/* Timestamp */}
      <span className="text-muted-foreground/50 shrink-0 w-16 tabular-nums">{time}</span>

      {/* Phase badge */}
      <Badge
        variant="outline"
        className={cn("text-[8px] px-1 py-0 h-3.5 shrink-0 font-semibold", PHASE_COLORS[entry.phase])}
      >
        {getPhaseLabel(entry.phase)}
      </Badge>

      {/* Status dot */}
      <span className={cn("shrink-0 font-semibold uppercase text-[8px] w-10", STATUS_COLORS[entry.status])}>
        {entry.status}
      </span>

      {/* Node info */}
      <span className="flex items-center gap-1 shrink-0">
        {Icon && <Icon className={cn("w-3 h-3", nodeStyle?.iconClass)} />}
        <span className={cn("font-medium", nodeStyle?.iconClass || "text-foreground")}>
          {entry.nodeLabel}
        </span>
      </span>

      {/* Message */}
      <span className="text-muted-foreground flex-1 min-w-0 truncate">
        {entry.message}
      </span>

      {/* Duration */}
      {entry.durationMs !== undefined && (
        <span className="text-muted-foreground/40 shrink-0 tabular-nums">{entry.durationMs}ms</span>
      )}

      {/* Downstream count */}
      {entry.downstreamIds && entry.downstreamIds.length > 0 && (
        <span className="text-cyan-500/70 shrink-0">
          →{entry.downstreamIds.length}
        </span>
      )}

      {/* Error */}
      {entry.error && (
        <span className="text-red-400 shrink-0 truncate max-w-[200px]" title={entry.error}>
          {entry.error}
        </span>
      )}
    </div>
  );
}

// ── Filter Select ──

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</span>
      <select
        className="text-[10px] bg-background border rounded px-1 py-0.5 text-foreground min-w-[80px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
