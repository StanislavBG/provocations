/**
 * ActivityLogsOverlay — Full-screen overlay for browsing lifecycle activity logs.
 *
 * Opened from the settings gear menu. Displays a filter panel on the left
 * and a table of log entries on the right.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  Trash2,
  Copy,
  Search,
  Activity,
  Pause,
  Play,
  ArrowDown,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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

const ALL_PHASES: LifecyclePhase[] = [
  "pre-process",
  "process",
  "post-process",
  "activate",
  "deactivate",
  "tick",
  "chain",
];
const ALL_STATUSES: LifecycleStatus[] = ["start", "success", "error", "skipped"];

interface ActivityLogsOverlayProps {
  onClose: () => void;
}

export function ActivityLogsOverlay({ onClose }: ActivityLogsOverlayProps) {
  const { entries, clear, getNodeTypes, getNodeIds } = useLifecycleLog();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [pausedSnapshot, setPausedSnapshot] = useState<LifecycleLogEntry[]>([]);

  // Filters
  const [filter, setFilter] = useState<LifecycleFilter>({});
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [initiatorFilter, setInitiatorFilter] = useState<"all" | "user" | "system">("all");

  const displayEntries = paused ? pausedSnapshot : entries;

  const filtered = useMemo(() => {
    let result = displayEntries;

    // Standard lifecycle filters
    const hasFilter = filter.nodeId || filter.nodeType || filter.phase || filter.status;
    if (hasFilter) {
      result = result.filter((e) => matchesFilter(e, filter));
    }

    // Keyword search
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      result = result.filter(
        (e) =>
          e.message.toLowerCase().includes(kw) ||
          e.nodeLabel.toLowerCase().includes(kw) ||
          e.nodeType.toLowerCase().includes(kw) ||
          (e.error && e.error.toLowerCase().includes(kw))
      );
    }

    // Date range
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((e) => e.timestamp >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000; // end of day
      result = result.filter((e) => e.timestamp < to);
    }

    // Initiator filter (heuristic: chain/tick/activate/deactivate = system, process = user)
    if (initiatorFilter === "user") {
      result = result.filter((e) => e.phase === "process" || e.phase === "pre-process" || e.phase === "post-process");
    } else if (initiatorFilter === "system") {
      result = result.filter((e) => e.phase === "chain" || e.phase === "tick" || e.phase === "activate" || e.phase === "deactivate");
    }

    return result;
  }, [displayEntries, filter, keyword, dateFrom, dateTo, initiatorFilter]);

  // Auto-scroll
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

  const handleExport = useCallback(() => {
    const text = formatLifecycleLog(filtered);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const handleClear = useCallback(() => {
    clear();
    setPausedSnapshot([]);
  }, [clear]);

  const nodeTypes = useMemo(() => getNodeTypes(), [displayEntries.length]);
  const nodeIds = useMemo(() => getNodeIds(), [displayEntries.length]);

  const clearAllFilters = () => {
    setFilter({});
    setKeyword("");
    setDateFrom("");
    setDateTo("");
    setInitiatorFilter("all");
  };

  const activeFilterCount =
    [filter.nodeId, filter.nodeType, filter.phase, filter.status].filter(Boolean).length +
    (keyword.trim() ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (initiatorFilter !== "all" ? 1 : 0);

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b bg-muted/30 shrink-0">
        <Activity className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-serif font-semibold flex-1">Activity Logs</h2>

        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
          {filtered.length}
          {filtered.length !== displayEntries.length ? `/${displayEntries.length}` : ""} events
        </Badge>

        {/* Toolbar */}
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 px-2 gap-1 text-xs", paused && "bg-amber-500/10 text-amber-500")}
          onClick={handlePauseToggle}
        >
          {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 px-2 text-xs", autoScroll && "text-primary")}
          onClick={() => setAutoScroll(!autoScroll)}
          title="Auto-scroll"
        >
          <ArrowDown className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopy} title="Copy">
          <Copy className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleExport} title="Export">
          <Download className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={handleClear} title="Clear all">
          <Trash2 className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Body: filters left, table right */}
      <div className="flex flex-1 min-h-0">
        {/* Left filter panel */}
        <div className="w-56 sm:w-64 shrink-0 border-r bg-muted/10 p-3 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Filters</span>
            {activeFilterCount > 0 && (
              <button className="text-[10px] text-primary hover:underline" onClick={clearAllFilters}>
                Clear all
              </button>
            )}
          </div>

          {/* Keyword search */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Keyword</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
              <Input
                className="h-7 text-xs pl-7"
                placeholder="Search messages..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>

          {/* Initiator */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Initiator</Label>
            <div className="flex gap-1">
              {(["all", "user", "system"] as const).map((v) => (
                <button
                  key={v}
                  className={cn(
                    "flex-1 text-[10px] py-1 rounded border transition-colors capitalize",
                    initiatorFilter === v
                      ? "bg-primary/15 border-primary/40 text-primary font-medium"
                      : "border-border/40 text-muted-foreground hover:bg-muted/50"
                  )}
                  onClick={() => setInitiatorFilter(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Node type */}
          <FilterSelect
            label="Node Type"
            value={filter.nodeType || ""}
            options={nodeTypes.map((t) => ({
              value: t,
              label: FLOW_NODE_REGISTRY[t]?.style.badge || t,
            }))}
            onChange={(v) => setFilter((f) => ({ ...f, nodeType: (v || undefined) as FlowNodeType | undefined }))}
          />

          {/* Specific node */}
          <FilterSelect
            label="Node"
            value={filter.nodeId || ""}
            options={nodeIds.map((n) => ({
              value: n.id,
              label: `${n.label} (${n.type})`,
            }))}
            onChange={(v) => setFilter((f) => ({ ...f, nodeId: v || undefined }))}
          />

          {/* Phase */}
          <FilterSelect
            label="Phase"
            value={filter.phase || ""}
            options={ALL_PHASES.map((p) => ({ value: p, label: getPhaseLabel(p) }))}
            onChange={(v) => setFilter((f) => ({ ...f, phase: (v || undefined) as LifecyclePhase | undefined }))}
          />

          {/* Status */}
          <FilterSelect
            label="Status"
            value={filter.status || ""}
            options={ALL_STATUSES.map((s) => ({ value: s, label: s }))}
            onChange={(v) => setFilter((f) => ({ ...f, status: (v || undefined) as LifecycleStatus | undefined }))}
          />

          {/* Date range */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Date From</Label>
            <Input
              type="date"
              className="h-7 text-xs"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Date To</Label>
            <Input
              type="date"
              className="h-7 text-xs"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        {/* Right: table */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Table header */}
          <div className="flex items-center gap-2 px-4 py-1.5 border-b bg-muted/20 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            <span className="w-20">Time</span>
            <span className="w-20">Phase</span>
            <span className="w-14">Status</span>
            <span className="w-16">Initiator</span>
            <span className="w-32">Node</span>
            <span className="flex-1">Message</span>
            <span className="w-16 text-right">Duration</span>
          </div>

          {/* Table rows */}
          <div ref={scrollRef} className="flex-1 overflow-auto min-h-0">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground/50 text-xs">
                {entries.length === 0 ? "No lifecycle events yet" : "No events match filters"}
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {filtered.map((entry) => (
                  <LogTableRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>

          {/* Paused indicator */}
          {paused && (
            <div className="flex items-center justify-center py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider border-t">
              Feed Paused
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogTableRow({ entry }: { entry: LifecycleLogEntry }) {
  const time = new Date(entry.timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = new Date(entry.timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const nodeStyle = FLOW_NODE_REGISTRY[entry.nodeType]?.style;
  const Icon = FLOW_NODE_REGISTRY[entry.nodeType]?.icon;

  const isSystemPhase =
    entry.phase === "chain" || entry.phase === "tick" || entry.phase === "activate" || entry.phase === "deactivate";

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-[10px] hover:bg-muted/20 transition-colors font-mono">
      <span className="text-muted-foreground/50 shrink-0 w-20 tabular-nums">
        {date} {time}
      </span>

      <span className="w-20 shrink-0">
        <Badge
          variant="outline"
          className={cn("text-[8px] px-1 py-0 h-3.5 font-semibold", PHASE_COLORS[entry.phase])}
        >
          {getPhaseLabel(entry.phase)}
        </Badge>
      </span>

      <span className={cn("shrink-0 font-semibold uppercase text-[8px] w-14", STATUS_COLORS[entry.status])}>
        {entry.status}
      </span>

      <span className="w-16 shrink-0 text-[9px]">
        <Badge
          variant="outline"
          className={cn(
            "text-[8px] px-1 py-0 h-3.5",
            isSystemPhase
              ? "bg-muted/30 text-muted-foreground border-border/50"
              : "bg-primary/10 text-primary border-primary/30"
          )}
        >
          {isSystemPhase ? "System" : "User"}
        </Badge>
      </span>

      <span className="flex items-center gap-1 shrink-0 w-32 min-w-0">
        {Icon && <Icon className={cn("w-3 h-3 shrink-0", nodeStyle?.iconClass)} />}
        <span className={cn("font-medium truncate", nodeStyle?.iconClass || "text-foreground")}>
          {entry.nodeLabel}
        </span>
      </span>

      <span className="text-muted-foreground flex-1 min-w-0 truncate">
        {entry.message}
        {entry.error && <span className="text-red-400 ml-1">{entry.error}</span>}
        {entry.downstreamIds && entry.downstreamIds.length > 0 && (
          <span className="text-cyan-500/70 ml-1">-&gt;{entry.downstreamIds.length}</span>
        )}
      </span>

      <span className="text-muted-foreground/40 shrink-0 w-16 text-right tabular-nums">
        {entry.durationMs !== undefined ? `${entry.durationMs}ms` : ""}
      </span>
    </div>
  );
}

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
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <select
        className="w-full text-xs bg-background border rounded px-2 py-1 text-foreground h-7"
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
